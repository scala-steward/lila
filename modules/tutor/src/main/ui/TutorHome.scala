package lila.tutor
package ui

import chess.format.pgn.PgnStr

import lila.core.perf.UserWithPerfs
import lila.ui.*
import lila.ui.ScalatagsTemplate.{ *, given }

final class TutorHome(helpers: Helpers, bits: TutorBits, q: TutorQueueUi):
  import helpers.{ *, given }

  def queued(in: TutorQueue.InQueue, user: UserWithPerfs, waitGames: List[(Pov, PgnStr)])(using Context) =
    bits.page(menu = emptyFrag, title = "Lichess Tutor - Examining games...", pageSmall = true)(
      cls := "tutor__empty tutor__queued box"
    ):
      frag(
        boxTop(h1("Lichess Tutor", bits.beta, bits.otherUser(user.id))),
        bits.mascotSays(
          whatTutorIsAbout,
          br,
          p(
            strong(cls := "tutor__intro")("You have ", q.nbGames(user), " games to look at. Here's the plan:")
          ),
          examinationMethod,
          p(
            (in.position > 10).option:
              frag("There are ", (in.position - 1), " players in the queue before you.", br)
            ,
            "Your report should be ready in about ",
            showMinutes(in.eta.toMinutes.toInt.atLeast(1)),
            "."
          )
        ),
        q.waitingGames(waitGames)
      )

  private def whatTutorIsAbout = frag(
    h2("What are your strengths and weaknesses?"),
    p("Lichess can examine your games and compare your playstyle to other players with similar rating."),
    br,
    p(
      "Tutor is all about statistical analysis and comparison to peers.",
      br,
      "No AI nonsense and no gimmicks; just concrete data about key metrics of your playstyle."
    )
  )

  private def examinationMethod = ol(
    li("Analyse many of your games with ", lila.ui.bits.engineFullName),
    li("Build detailed insight reports for each of your games"),
    li("Compare these insights to other players with the same rating")
  )

  def start(user: UserId)(using Context) =
    val form = TutorConfig.form.full(user)
    bits.page(menu = emptyFrag, pageSmall = true)(cls := "tutor__empty box"):
      frag(
        boxTop(h1("Lichess Tutor", bits.beta, bits.otherUser(user))),
        bits.mascotSays(
          whatTutorIsAbout
        ),
        postForm(cls := "tutor__empty__cta", action := routes.Tutor.compute(user))(
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
