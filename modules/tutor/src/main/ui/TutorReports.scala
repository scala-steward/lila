package lila.tutor
package ui

import play.api.data.Form

import lila.ui.*
import lila.ui.ScalatagsTemplate.{ *, given }

final class TutorReportsUi(helpers: Helpers, bits: TutorBits):
  import helpers.{ *, given }

  def apply(user: User, form: Form[TutorConfig], previews: List[TutorFullReport.Preview])(using Context) =
    bits
      .page(menu = emptyFrag)(cls := "tutor__reports tutor-layout"):
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
          postForm(cls := "form3", action := routes.Tutor.compute(user.id))(
            form3.fieldset("Request a new Tutor report", toggle = true.some)(cls := "box-pad")(
              form3.split(
                form3.group(
                  form("from"),
                  "Start date",
                  half = true
                )(form3.flatpickr(_, local = true, minDate = None))
              )
            ),
            div(cls := "tutor__reports-list")(
              ul(cls := "tutor__reports-list__list")(
                previews.map: preview =>
                  li(cls := "tutor__reports-list__item")(
                    a(href := preview.config.url.root)(
                      momentFromNow(preview.at)
                    )
                  )
              )
            )
          )
        )
      .css("bits.form3")
