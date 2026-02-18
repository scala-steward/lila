package lila.tutor
package ui

import chess.format.pgn.PgnStr

import lila.core.perf.UserWithPerfs
import lila.ui.*
import lila.ui.ScalatagsTemplate.{ *, given }

final class TutorQueueUi(helpers: Helpers, bits: TutorBits):
  import helpers.{ *, given }

  def awaitingBox(a: TutorQueue.Awaiting)(using Context) =
    frag(
      boxTop(h1("Lichess Tutor", bits.beta, bits.otherUser(a.q.item.config.user))),
      bits.mascotSays(
        whatTutorIsAbout,
        br,
        p(strong(cls := "tutor__intro")("Here's the plan:")),
        examinationMethod,
        p(
          (a.q.position > 10).option:
            frag("There are ", (a.q.position - 1), " players in the queue before you.", br)
          ,
          "Your report should be ready in about ",
          showMinutes(a.q.eta.toMinutes.toInt.atLeast(1)),
          "."
        )
      ),
      div(cls := "tutor__waiting-games"):
        div(cls := "tutor__waiting-games__carousel"):
          a.games.map: (pov, pgn) =>
            div(
              cls := "tutor__waiting-game lpv lpv--todo lpv--moves-false lpv--controls-false",
              st.data("pgn") := pgn.value,
              st.data("pov") := pov.color.name
            )
    )

  def whatTutorIsAbout = frag(
    h2("What are your strengths and weaknesses?"),
    p("Lichess can examine your games and compare your playstyle to other players with similar rating."),
    br,
    p(
      "Tutor is all about statistical analysis and comparison to peers.",
      br,
      "No AI nonsense and no gimmicks; just concrete data about key metrics of your playstyle."
    )
  )

  def examinationMethod = ol(
    li("Analyse many of your games with ", lila.ui.bits.engineFullName),
    li("Build detailed insight reports for each of your games"),
    li("Compare these insights to other players with the same rating")
  )
