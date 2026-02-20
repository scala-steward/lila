package lila.tutor
package ui

import java.time.LocalDate
import play.api.data.{ Form, Field }

import lila.ui.*
import lila.ui.ScalatagsTemplate.{ *, given }

final class TutorReportsUi(helpers: Helpers, bits: TutorBits, q: TutorQueueUi):
  import helpers.{ *, given }

  def newForm(user: UserId, form: Form[?])(using Context) =
    postForm(cls := "form3 tutor__report-form", action := routes.Tutor.compute(user.id)):
      form3.fieldset("Request a new Tutor report", toggle = true.some)(cls := "box-pad")(
        form3.split(
          form3.group(form("from"), "Start date")(datePickr)(cls := "form-third"),
          form3.group(form("to"), "End date")(datePickr)(cls := "form-third"),
          form3.submit("Compute my tutor report", icon = none)
        )
      )

  def list(previews: List[TutorFullReport.Preview])(using Context) =
    div(cls := "box tutor__reports-list")(
      previews.map(preview)
    )

  private def preview(p: TutorFullReport.Preview)(using Context) =
    a(href := p.config.url.root)(
      momentFromNow(p.at),
      p.toString
    )

  private def datePickr(field: Field) = form3.flatpickr(
    field,
    withTime = false,
    local = true,
    minDate = TutorConfig.format(TutorConfig.minFrom).some,
    maxDate = TutorConfig.format(LocalDate.now).some
  )
