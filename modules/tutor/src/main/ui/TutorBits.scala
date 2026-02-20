package lila.tutor
package ui

import lila.ui.*

import ScalatagsTemplate.{ *, given }
import lila.rating.PerfType

final class TutorBits(helpers: Helpers)(
    val openingUrl: chess.opening.Opening => Call
):
  import helpers.{ *, given }

  def page(menu: Frag, title: String = "Lichess Tutor", pageSmall: Boolean = false)(mods: AttrPair*): Page =
    Page(title)
      .css("tutor.report")
      .js(Esm("tutor"))
      .csp(_.withInlineIconFont)
      .wrap: body =>
        main(cls := List("page-menu tutor" -> true, "page-small" -> pageSmall))(
          lila.ui.bits.subnav(menu),
          div(cls := "page-menu__content")(mods, body)
        )

  def mascot =
    img(
      cls := "mascot",
      src := assetUrl("images/mascot/octopus-shadow.svg")
    )

  def mascotSays(content: Modifier*) = div(cls := "mascot-says")(
    div(cls := "mascot-says__content")(content),
    mascot
  )

  val seeMore = a(cls := "tutor-card__more")("Click to see more...")

  def percentNumber[A](v: A)(using number: TutorNumber[A]) = f"${number.double(v)}%1.1f"
  def percentFrag[A](v: A)(using TutorNumber[A]) = frag(strong(percentNumber(v)), "%")

  def beta = strong(cls := "tutor__beta")("BETA")

  def otherUser(user: UserId)(using ctx: Context) =
    ctx.isnt(user).option(userIdSpanMini(user, withOnline = false))

  def menu(full: TutorFullReport, report: Option[TutorPerfReport])(using Context) = frag(
    a(href := full.url.root, cls := report.isEmpty.option("active"))("Tutor"),
    full.perfs.map: p =>
      a(
        cls := List("active" -> report.exists(_.perf === p.perf)),
        dataIcon := p.perf.icon,
        href := full.url.perf(p.perf)
      )(p.perf.trans)
  )

  def perfSelector(full: TutorFullReport, current: PerfType, angle: Option[Angle])(using
      Context
  ) =
    lila.ui.bits.mselect(
      "tutor-perf-select",
      span(cls := "text", dataIcon := current.icon)(current.trans),
      full.perfs.toList.map: r =>
        a(
          href := full.url.angle(r.perf, angle),
          cls := List("text" -> true, "current" -> (current == r.perf)),
          dataIcon := r.perf.icon
        )(r.perf.trans)
    )

  def reportSelector(report: TutorPerfReport, current: Angle)(using config: TutorConfig) =
    lila.ui.bits.mselect(
      "tutor-report-select",
      span(reportAngles.find(_._1 == current).map(_._2) | current),
      reportAngles.map: (angle, name) =>
        a(
          href := config.url.angle(report.perf, angle),
          cls := (current == angle).option("current")
        )(name)
    )

  val reportAngles: List[(Angle, String)] = List(
    ("skills", "Skills"),
    ("opening", "Openings"),
    ("time", "Time management"),
    ("phases", "Game phases"),
    ("pieces", "Pieces")
  )
