package lila.tree
import chess.format.pgn.{ Glyph, Glyphs }
import chess.format.{ Fen, Uci, UciCharPair, UciPath }
import chess.json.Json.given
import chess.opening.Opening
import chess.variant.{ Crazyhouse, Variant }
import chess.{ Bitboard, Check, HasId, Mergeable, Node as ChessNode, Ply, Position, Square, Tree, Variation }
import monocle.syntax.all.*
import play.api.libs.json.*
import scalalib.json.Json.given

import Node.{ Comments, Comment, Gamebook, Shapes }

case class Metas(
    ply: Ply,
    fen: Fen.Full,
    check: Check,
    // None when not computed yet
    dests: Option[Map[Square, Bitboard]] = None,
    drops: Option[List[Square]] = None,
    eval: Option[Eval] = None,
    shapes: Node.Shapes = Shapes.empty,
    comments: Node.Comments = Comments.empty,
    gamebook: Option[Node.Gamebook] = None,
    glyphs: Glyphs = Glyphs.empty,
    opening: Option[Opening] = None,
    clock: Option[Clock] = None,
    crazyData: Option[Crazyhouse.Data] = None
    // TODO, add support for variationComments
):
  def setComment(comment: Comment): Metas =
    copy(comments = comments.set(comment))
  def deleteComment(comment: Comment.Id): Metas =
    copy(comments = comments.delete(comment))
  def deleteComments: Metas =
    copy(comments = Comments.empty)
  def toggleGlyph(glyph: Glyph): Metas =
    copy(glyphs = glyphs.toggle(glyph))
  def turn: Color = ply.turn

object Metas:
  def default(variant: Variant): Metas =
    Metas(
      ply = Ply.initial,
      fen = variant.initialFen,
      check = Check.No,
      crazyData = variant.crazyhouse.option(Crazyhouse.Data.init)
    )
  def apply(sit: Position.AndFullMoveNumber): Metas =
    Metas(
      ply = sit.ply,
      fen = Fen.write(sit),
      check = sit.position.check,
      clock = none,
      crazyData = sit.position.crazyData
    )

case class NewBranch(
    id: UciCharPair,
    move: Uci.WithSan,
    comp: Boolean = false, // generated by a computer analysis
    forceVariation: Boolean = false,
    metas: Metas
):
  export metas.{
    ply,
    fen,
    check,
    dests,
    drops,
    eval,
    shapes,
    comments,
    gamebook,
    glyphs,
    opening,
    clock,
    crazyData
  }
  override def toString = s"$ply, $id, ${move.uci}"
  def withClock(clock: Option[Clock]) = this.focus(_.metas.clock).replace(clock)
  def withForceVariation(force: Boolean) = copy(forceVariation = force)
  def isCommented = metas.comments.value.nonEmpty
  def setComment(comment: Comment) = this.focus(_.metas).modify(_.setComment(comment))
  def deleteComment(commentId: Comment.Id) = this.focus(_.metas).modify(_.deleteComment(commentId))
  def deleteComments = this.focus(_.metas.comments).replace(Comments.empty)
  def setGamebook(gamebook: Gamebook) = this.focus(_.metas.gamebook).replace(gamebook.some)
  def setShapes(s: Shapes) = this.focus(_.metas.shapes).replace(s)
  def toggleGlyph(glyph: Glyph) = this.focus(_.metas).modify(_.toggleGlyph(glyph))
  def clearAnnotations = this
    .focus(_.metas)
    .modify(_.copy(shapes = Shapes.empty, glyphs = Glyphs.empty, comments = Comments.empty))
  def setComp = copy(comp = true)

  def merge(n: NewBranch): Option[NewBranch] =
    Option.when(this.sameId(n)):
      copy(
        metas = metas.copy(
          shapes = metas.shapes ++ n.metas.shapes,
          comments = metas.comments ++ n.metas.comments,
          gamebook = n.metas.gamebook.orElse(metas.gamebook),
          glyphs = metas.glyphs.merge(n.metas.glyphs),
          eval = n.metas.eval.orElse(metas.eval),
          clock = n.metas.clock.orElse(metas.clock),
          crazyData = n.metas.crazyData.orElse(metas.crazyData)
        ),
        forceVariation = n.forceVariation || forceVariation
      )

object NewBranch:
  given HasId[NewBranch, UciCharPair] = _.id
  given Mergeable[NewBranch] with
    extension (a: NewBranch) def merge(other: NewBranch): Option[NewBranch] = a.merge(other)

type NewTree = ChessNode[NewBranch]

object NewTree:
  // default case class constructor not working with type alias?
  def apply(value: NewBranch, child: Option[NewTree], variations: List[Variation[NewBranch]]) =
    ChessNode(value, child, variations)

  def apply(root: Root): Option[NewTree] =
    root.children.first.map: first =>
      NewTree(
        value = fromBranch(first),
        child = first.children.first.map(fromBranch(_, first.children.variations)),
        variations = root.children.variations.map(toVariation)
      )

  def toVariation(branch: Branch): Variation[NewBranch] =
    Variation(
      value = fromBranch(branch),
      child = branch.children.first.map(fromBranch(_, branch.children.variations))
    )

  def fromBranch(branch: Branch, variations: List[Branch] = Nil): NewTree =
    NewTree(
      value = fromBranch(branch),
      child = branch.children.first.map(fromBranch(_, branch.children.variations)),
      variations = variations.map(toVariation)
    )

  def fromBranch(branch: Branch): NewBranch =
    NewBranch(
      branch.id,
      branch.move,
      branch.comp,
      branch.forceVariation,
      fromNode(branch)
    )

  def fromNode(node: Node): Metas =
    Metas(
      node.ply,
      node.fen,
      node.check,
      node.dests,
      node.drops,
      node.eval,
      node.shapes,
      node.comments,
      node.gamebook,
      node.glyphs,
      node.opening,
      node.clock,
      node.crazyData
    )

  import NewRoot.given
  given defaultNodeJsonWriter: Writes[NewTree] =
    NewRoot.makeNodeWriter

  // def filterById(id: UciCharPair) = ChessNode.filterOptional[NewBranch](_.id == id)
  // def fromNodeToBranch(node: Node): NewBranch = ???

case class NewRoot(metas: Metas, tree: Option[NewTree]):

  export metas.{
    ply,
    fen,
    check,
    dests,
    drops,
    eval,
    shapes,
    comments,
    gamebook,
    glyphs,
    opening,
    clock,
    crazyData
  }

  def mainline: List[NewTree] = tree.fold(List.empty[NewTree])(_.mainline)

  def mainlineValues: List[NewBranch] = tree.fold(List.empty[NewBranch])(_.mainlineValues)

  def lastMainlinePly: Ply = mainlineValues.lastOption.fold(Ply.initial)(_.ply)

  def lastMainlinePlyOf(path: UciPath) =
    mainlineValues
      .zip(path.computeIds)
      .takeWhile((node, id) => node.id == id)
      .lastOption
      .fold(Ply.initial)((node, _) => node.metas.ply)

  def mapChildren(f: NewBranch => NewBranch): NewRoot =
    copy(tree = tree.map(_.map(f)))

  def pathExists(path: UciPath): Boolean =
    path.isEmpty || tree.exists(_.pathExists(path.ids))

  def nodeAt(path: UciPath): Option[Tree[NewBranch]] =
    path.nonEmpty.so(tree.flatMap(_.find(path.ids)))

  def deleteNodeAt(path: UciPath): Option[NewRoot] =
    if tree.isEmpty && path.isEmpty then copy(tree = none).some
    else tree.flatMap(_.deleteAt(path.ids)).flatten.map(x => copy(tree = x.some))

  def addNodeAt(path: UciPath, node: NewTree): Option[NewRoot] =
    if tree.isEmpty && path.isEmpty then copy(tree = node.some).some
    else tree.flatMap(_.addChildAt(path.ids, node)).map(x => copy(tree = x.some))

  def addChild(child: NewTree): NewRoot =
    if tree.isEmpty then copy(tree = child.some)
    else copy(tree = tree.map(_.mergeOrAddAsVariation(child)))

  def addBranchAt(path: UciPath, branch: NewBranch): Option[NewRoot] =
    if tree.isEmpty && path.isEmpty then copy(tree = ChessNode(branch).some).some
    else tree.flatMap(_.addValueAsChildAt(path.ids, branch)).map(x => copy(tree = x.some))

  def modifyWithParentPathMetas(path: UciPath, f: Metas => Metas): Option[NewRoot] =
    if tree.isEmpty && path.isEmpty then copy(metas = f(metas)).some
    else
      tree.flatMap:
        _.modifyChildAt(path.ids, _.focus(_.value.metas).modify(f).some).map(x => copy(tree = x.some))

  def modifyAt(path: UciPath, f: Metas => Metas): Option[NewRoot] =
    def b(n: NewBranch): NewBranch = n.focus(_.metas).modify(f)
    if path.isEmpty then copy(metas = f(metas)).some
    else
      tree.flatMap:
        _.modifyAt(path.ids, Tree.liftOption(b)).map(x => copy(tree = x.some))

  def modifyBranchAt(path: UciPath, f: NewBranch => NewBranch): Option[NewRoot] =
    path.nonEmpty.so:
      tree.flatMap:
        _.modifyAt(path.ids, Tree.liftOption(f)).map(x => copy(tree = x.some))

  def modifyWithParentPath(path: UciPath, f: NewBranch => NewBranch): Option[NewRoot] =
    if tree.isEmpty && path.isEmpty then this.some
    else
      tree.flatMap:
        _.modifyChildAt(path.ids, _.focus(_.value).modify(f).some).map(x => copy(tree = x.some))

  def updateTree(f: NewTree => Option[NewTree]): NewRoot =
    copy(tree = tree.flatMap(f))

  def withoutChildren: NewRoot = copy(tree = None)

  def withTree(t: Option[NewTree]): NewRoot =
    copy(tree = t)

  inline def isEmpty = tree.isEmpty
  inline def nonEmpty = tree.nonEmpty

  def size = tree.fold(0L)(_.size)

  def mainlinePath = tree.fold(UciPath.root)(x => UciPath.fromIds(x.mainlinePath))

  def lastMainlineNode: Option[ChessNode[NewBranch]] = tree.map(_.lastMainlineNode)
  def lastMainlineMetas: Option[Metas] = lastMainlineNode.map(_.value.metas)
  def lastMainlineMetasOrRoots: Metas = lastMainlineMetas | metas

  def takeMainlineWhile(f: NewBranch => Boolean): NewRoot =
    tree.fold(this)(t => copy(tree = t.takeMainlineWhile(f)))

  // TODO: better name modifyLastMainlineOrRoot
  def updateMainlineLast(f: Metas => Metas): NewRoot =
    tree.fold(copy(metas = f(metas))): tree =>
      copy(tree = tree.modifyLastMainlineNode(_.updateValue(_.focus(_.metas).modify(f))).some)

  def clearVariations: NewRoot =
    updateTree(_.clearVariations.some)

  override def toString = s"$tree"

object NewRoot:
  def default(variant: Variant) = NewRoot(Metas.default(variant), None)
  def apply(sit: Position.AndFullMoveNumber): NewRoot = NewRoot(Metas(sit), None)
  def apply(root: Root): NewRoot = NewRoot(NewTree.fromNode(root), NewTree(root))

  import lila.tree.evals.jsonWrites
  import Node.given

  given metasWriter: OWrites[Metas] = OWrites: metas =>
    import metas.*
    val comments: List[Comment] = metas.comments.value.flatMap(_.removeMeta)
    Json
      .obj(
        "ply" -> ply,
        "fen" -> fen
      )
      .add("check", check)
      .add("eval", eval.filterNot(_.isEmpty))
      .add("comments", Option.when(comments.nonEmpty)(comments))
      .add("gamebook", gamebook)
      .add("glyphs", glyphs.nonEmpty)
      .add("shapes", Option.when(shapes.value.nonEmpty)(shapes.value))
      .add("opening", opening)
      .add("dests", dests)
      .add("drops", drops.map(drops => JsString(drops.map(_.key).mkString)))
      .add("clock", clock.map(_.centis))
      .add("crazy", crazyData)

  given OWrites[NewBranch] = OWrites: branch =>
    metasWriter
      .writes(branch.metas)
      .add("id", branch.id.toString.some)
      .add("uci", branch.move.uci.uci.some)
      .add("san", branch.move.san.some)
      .add("comp", branch.comp)
      .add("forceVariation", branch.forceVariation)

  given defaultNodeJsonWriter: Writes[NewRoot] = makeRootJsonWriter(alwaysChildren = true)
  val minimalNodeJsonWriter: Writes[NewRoot] = makeRootJsonWriter(alwaysChildren = false)
  given defaultTreeJsonWriter: Writes[Tree[NewBranch]] = makeTreeWriter(alwaysChildren = true)
  val minimalTreeJsonWriter: Writes[Tree[NewBranch]] = makeTreeWriter(alwaysChildren = false)

  def makeTreeWriter[A](alwaysChildren: Boolean)(using wa: OWrites[A]): Writes[Tree[A]] = Writes: tree =>
    wa.writes(tree.value)
      .add(
        "children",
        Option.when(alwaysChildren || tree.childAndChildVariations.nonEmpty):
          nodeListJsonWriter(alwaysChildren).writes(tree.childAndChildVariations)
      )

  def makeNodeWriter[A](using OWrites[A]): Writes[ChessNode[A]] =
    makeTreeWriter(true).contramap(identity)

  def makeMainlineWriter[A](using wa: OWrites[A]): Writes[ChessNode[A]] = Writes: tree =>
    wa.writes(tree.value)
      .add(
        "children",
        Option.when(tree.childVariations.nonEmpty):
          nodeListJsonWriter(true).writes(tree.childVariations)
      )

  def nodeListJsonWriter[A](alwaysChildren: Boolean)(using OWrites[A]): Writes[List[Tree[A]]] =
    Writes: list =>
      JsArray(list.map(makeTreeWriter(alwaysChildren).writes))

  def makeRootJsonWriter(alwaysChildren: Boolean): Writes[NewRoot] =
    Writes: root =>
      metasWriter
        .writes(root.metas)
        .add("id", none[String])
        .add("uci", none[String])
        .add("san", none[String])
        .add("comp", none[Int])
        .add("forceVariation", none[Boolean])
        .add(
          "children",
          Option.when(alwaysChildren || root.tree.isDefined):
            nodeListJsonWriter(true)
              .writes(root.tree.fold(Nil)(x => x.withoutVariations :: x.variations))
        )

  val mainlineWriterForRoot: Writes[NewRoot] =
    Writes: root =>
      metasWriter
        .writes(root.metas)
        .add("id", none[String])
        .add("uci", none[String])
        .add("san", none[String])
        .add("comp", none[Int])
        .add("forceVariation", none[Boolean])
        .add(
          "children",
          Option.when(root.tree.exists(_.childAndVariations.nonEmpty)):
            nodeListJsonWriter(true).writes(root.tree.fold(Nil)(_.childAndVariations))
        )

  val partitionTreeJsonWriter: Writes[NewRoot] = Writes: root =>
    val rootWithoutChild = root.updateTree(_.withoutChild.some)
    val mainLineWriter = makeMainlineWriter[NewBranch]
    JsArray:
      mainlineWriterForRoot.writes(rootWithoutChild) +: root.mainline.map(mainLineWriter.writes)
