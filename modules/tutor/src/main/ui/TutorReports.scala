package lila.tutor
package ui

import play.api.data.Form

import lila.ui.*
import lila.ui.ScalatagsTemplate.{ *, given }

final class TutorReportsUi(helpers: Helpers, bits: TutorBits):
  import helpers.*

  def apply(user: User, form: Form[TutorConfig], reports: List[TutorFullReport])(using Context) =
    bits.page(menu = emptyFrag)(cls := "tutor__reports tutor-layout"):
      frag(
        div(cls := "box tutor__first-box")(
          boxTop(h1("Lichess Tutor", bits.beta, bits.otherUser(user.id))),
          bits.mascotSays(
            p(
              "Here you can find all the reports that have been generated for your account."
            ),
            p(
              "Click on any of them to see the details and insights about your playstyle at the time of the report."
            )
          )
        ),
        div(cls := "tutor__reports-list")(
          ul(cls := "tutor__reports-list__list")(
            reports.toList.sortBy(_.at)(using Ordering[Instant].reverse).map { report =>
              li(cls := "tutor__reports-list__item")(
                a(href := report.url.root)(
                  momentFromNow(report.at)
                )
              )
            }
          )
        )
      )
