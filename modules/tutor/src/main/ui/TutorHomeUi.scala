package lila.tutor
package ui

import chess.format.pgn.PgnStr

import lila.core.perf.UserWithPerfs
import lila.ui.*
import lila.ui.ScalatagsTemplate.{ *, given }

final class TutorHomeUi(helpers: Helpers, bits: TutorBits, q: TutorQueueUi, rps: TutorReportsUi)(using
    Context
):
  import helpers.{ *, given }

  def apply(home: TutorHome)(using Context) =
    val form = TutorConfig.form.full
    bits.page(menu = emptyFrag, pageSmall = true)(cls := "tutor__empty box"):
      frag(
        boxTop(h1("Lichess Tutor", bits.beta, bits.otherUser(home.user))),
        bits.mascotSays(q.whatTutorIsAbout),
        postForm(cls := "tutor__empty__cta", action := routes.Tutor.compute(home.user))(
          form3.hidden(form("from")),
          form3.hidden(form("to")),
          submitButton(cls := "button button-fat button-no-upper")("Compute my tutor report")
        )
      )

  def insufficientGames(user: UserId)(using Context) =
    bits.page(menu = emptyFrag, pageSmall = true)(cls := "tutor__insufficient box"):
      frag(
        boxTop(h1(bits.otherUser(user), "Lichess Tutor")),
        mascotSaysInsufficient
      )

  def mascotSaysInsufficient =
    bits.mascotSays(
      frag(
        strong("Not enough rated games to examine!"),
        br,
        "Please come back after you have played more chess."
      )
    )
