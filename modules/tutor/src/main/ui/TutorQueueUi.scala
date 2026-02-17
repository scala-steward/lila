package lila.tutor
package ui

import chess.format.pgn.PgnStr

import lila.core.perf.UserWithPerfs
import lila.ui.*
import lila.ui.ScalatagsTemplate.{ *, given }

final class TutorQueueUi(helpers: Helpers):
  import helpers.{ *, given }

  def waitingGames(games: List[(Pov, PgnStr)]) =
    div(cls := "tutor__waiting-games"):
      div(cls := "tutor__waiting-games__carousel"):
        games.map: (pov, pgn) =>
          div(
            cls := "tutor__waiting-game lpv lpv--todo lpv--moves-false lpv--controls-false",
            st.data("pgn") := pgn.value,
            st.data("pov") := pov.color.name
          )

  def nbGames(user: UserWithPerfs)(using Translate): String =
    lila.rating.PerfType.standardWithUltra
      .foldLeft(0)((nb, pt) => nb + user.perfs(pt).nb)
      .atMost(10_000)
      .localize
