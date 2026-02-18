package lila.tutor
package ui

import play.api.data.Form

import lila.ui.*
import lila.ui.ScalatagsTemplate.{ *, given }

final class TutorHomeUi(helpers: Helpers, bits: TutorBits, q: TutorQueueUi, rps: TutorReportsUi):
  import helpers.*

  def apply(home: TutorHome, form: Form[?])(using Context) =
    bits
      .page(menu = emptyFrag, pageSmall = true)(cls := "tutor-home"):
        if home.previews.isEmpty
        then newUser(home)
        else withReports(home, form)
      .css("tutor.reports")
      .js(Esm("bits.flatpickr"))

  private def newUser(home: TutorHome)(using Context) =
    import home.*
    frag(
      div(cls := "box")(title(user), bits.mascotSays(q.whatTutorIsAbout)),
      awaiting match
        case None => firstReportButton(user)
        case Some(a) => q.waitingZone(a)
    )

  private def withReports(home: TutorHome, form: Form[?])(using Context) =
    import home.*
    frag(
      div(cls := "box")(
        bits.mascotSays(
          p("Here you can find all the reports that have been generated for your account."),
          p(
            "Click on any of them to see the details and insights about your playstyle at the time of the report."
          )
        )
      ),
      div(cls := "box")(
        awaiting match
          case Some(a) => q.waitingZone(a)
          case None => rps.newForm(user, form),
        rps.list(previews)
      )
    )

  private def title(user: UserId)(using Context) =
    boxTop(h1("Lichess Tutor", bits.beta, bits.otherUser(user)))

  private def firstReportButton(user: UserId) =
    val form = TutorConfig.form.full
    postForm(cls := "tutor__first-report", action := routes.Tutor.compute(user))(
      form3.hidden(form("from")),
      form3.hidden(form("to")),
      submitButton(cls := "button button-fat button-no-upper")("Compute my tutor report")
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
