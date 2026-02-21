package lila.tutor
package ui

import java.time.LocalDate
import play.api.data.{ Form, Field }

import lila.ui.*
import lila.ui.ScalatagsTemplate.{ *, given }

final class TutorReportsUi(helpers: Helpers):
  import helpers.{ *, given }

  def newForm(user: UserId, form: Form[?])(using Context) =
    postForm(cls := "form3 tutor__report-form", action := routes.Tutor.compute(user.id)):
      form3.fieldset("Request a new Tutor report", toggle = false.some)(cls := "box-pad")(
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
    val days = daysBetween(p.config.from, p.config.to)
    a(href := p.config.url.root, cls := "tutor-preview")(
      // momentFromNow(p.at),
      span(cls := "tutor-preview__dates")(
        span(
          semanticDate(p.config.from),
          " → ",
          semanticDate(p.config.to)
        ),
        trans.site.nbDays.plural(days, days)
      ),
      span(cls := "tutor-preview__perfs"):
        p.perfs
          .take(3)
          .map: perf =>
            span(cls := "tutor-preview__perf", dataIcon := perf.perf.icon)(
              span(cls := "tutor-preview__perf__data")(
                span(cls := "tutor-preview__perf__nb"):
                  trans.site.nbGames.plural(perf.stats.totalNbGames, perf.stats.totalNbGames.localize)
                ,
                span(cls := "tutor-preview__perf__rating")(
                  trans.site.rating(),
                  " ",
                  strong(perf.stats.rating)
                )
              )
            )
      ,
      span(cls := "tutor-preview__nbGames")(trans.site.nbGames.plural(p.nbGames, p.nbGames.localize))
    )

  private def datePickr(field: Field) = form3.flatpickr(
    field,
    withTime = false,
    local = true,
    minDate = TutorConfig.format(TutorConfig.minFrom).some,
    maxDate = TutorConfig.format(LocalDate.now).some
  )
