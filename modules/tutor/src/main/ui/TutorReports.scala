package lila.tutor
package ui

import java.time.LocalDate
import play.api.data.{ Form, Field }

import lila.ui.*
import lila.ui.ScalatagsTemplate.{ *, given }

final class TutorReportsUi(helpers: Helpers, bits: TutorBits, q: TutorQueueUi):
  import helpers.{ *, given }

  def apply(
      user: User,
      form: Form[TutorConfig],
      awaiting: Option[TutorQueue.Awaiting],
      previews: List[TutorFullReport.Preview]
  )(using Context) =
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
          awaiting.map: a =>
            q.waitingGames(a.games),
          awaiting.isEmpty.option:
            postForm(cls := "form3 tutor__report-form", action := routes.Tutor.compute(user.id)):
              form3.fieldset("Request a new Tutor report", toggle = true.some)(cls := "box-pad")(
                form3.split(
                  form3.group(form("from"), "Start date")(datePickr)(cls := "form-third"),
                  form3.group(form("to"), "End date")(datePickr)(cls := "form-third"),
                  form3.submit("Compute my tutor report")
                )
              )
          ,
          div(cls := "box tutor__reports-list")(
            ul(cls := "slist tutor__reports-list__list")(
              previews.map: preview =>
                li(cls := "tutor__reports-list__item")(
                  a(href := preview.config.url.root)(
                    momentFromNow(preview.at),
                    preview.toString
                  )
                )
            )
          )
        )
      .css("tutor.reports")
      .js(Esm("bits.flatpickr"))

  private def datePickr(field: Field) = form3.flatpickr(
    field,
    withTime = false,
    local = true,
    minDate = TutorConfig.format(TutorConfig.minFrom).some,
    maxDate = TutorConfig.format(LocalDate.now).some
  )
