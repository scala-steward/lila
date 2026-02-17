package controllers

import play.api.mvc.*

import lila.app.{ *, given }
import lila.common.LilaOpeningFamily
import lila.rating.PerfType
import lila.tutor.{ TutorFullReport, TutorPerfReport, TutorQueue, TutorConfig }

final class Tutor(env: Env) extends LilaController(env):

  def home = Auth { _ ?=> me ?=>
    Redirect(routes.Tutor.user(me.username))
  }

  def user(username: UserStr) = Auth { _ ?=> _ ?=>
    WithUser(username): user =>
      import TutorFullReport.Availability.*
      for
        withPerfs <- env.user.api.withPerfs(user)
        av <- env.tutor.api.availability(withPerfs)
        res <- av match
          case InsufficientGames =>
            BadRequest.page(views.tutor.home.insufficientGames(username.id))
          case Empty(in: TutorQueue.InQueue) =>
            for
              waitGames <- env.tutor.queue.waitingGames(user.id)
              page <- renderPage(views.tutor.home.queued(in, withPerfs, waitGames))
            yield Accepted(page)
          case Empty(_) => Accepted.page(views.tutor.home.start(user.id))
          case Available(r) => Ok.page(views.tutor.report(r))
      yield res
  }

  def reports(username: UserStr) = Auth { _ ?=> _ ?=>
    WithUser(username): user =>
      for
        previews <- env.tutor.api.previews(user.id)
        res <-
          if previews.isEmpty then Redirect(routes.Tutor.user(username)).toFuccess
          else
            for
              awaiting <- env.tutor.queue.awaiting(user.id)
              form = TutorConfig.form.default(user.id)
              res <- Ok.page(views.tutor.reports(user, form, awaiting, previews))
            yield res
      yield res
  }

  def report(username: UserStr, range: String) = TutorReport(username, range) { _ ?=> full =>
    Ok.page(views.tutor.report(full))
  }

  def perf(username: UserStr, range: String, perf: PerfKey) = TutorPerfPage(username, range, perf) {
    _ ?=> full => perf =>
      Ok.page(views.tutor.perf(full, perf))
  }

  def angle(username: UserStr, range: String, perf: PerfKey, angle: String) =
    TutorPerfPage(username, range, perf) { _ ?=> full => perf =>
      angle match
        case "skills" => Ok.page(views.tutor.perf.skills(full, perf))
        case "phases" => Ok.page(views.tutor.perf.phases(full, perf))
        case "time" => Ok.page(views.tutor.perf.time(full, perf))
        case "pieces" => Ok.page(views.tutor.perf.pieces(full, perf))
        case "opening" => Ok.page(views.tutor.openingUi.openings(full, perf))
        case _ => notFound
    }

  def opening(username: UserStr, range: String, perf: PerfKey, color: Color, opName: String) =
    TutorPerfPage(username, range, perf) { _ ?=> full => perf =>
      LilaOpeningFamily
        .find(opName)
        .flatMap(perf.openings(color).find)
        .fold(Redirect(full.url.angle(perf.perf, "opening")).toFuccess): family =>
          env.puzzle.opening.find(family.family.key).flatMap { puzzle =>
            Ok.page(views.tutor.opening(full, perf, family, color, puzzle))
          }
    }

  def compute(username: UserStr) = AuthBody { _ ?=> _ ?=>
    WithUser(username): user =>
      bindForm(TutorConfig.form.dates(user.id))(
        err =>
          for
            previews <- env.tutor.api.previews(user.id)
            awaiting <- env.tutor.queue.awaiting(user.id)
            res <- BadRequest.page(views.tutor.reports(user, err, awaiting, previews))
          yield res,
        config =>
          env.tutor.api
            .get(config)
            .flatMap:
              case Some(report) => Redirect(report.url.root).toFuccess
              case None =>
                for _ <- env.tutor.queue.enqueue(config)
                yield Redirect(routes.Tutor.reports(user.username))
      )
  }

  private def WithUser(username: UserStr)(f: UserModel => Fu[Result])(using
      me: Me
  )(using Context): Fu[Result] =
    val user: Fu[Option[UserModel]] =
      if me.is(username) then fuccess(me.some)
      else
        env.user.api
          .byId(username.id)
          .flatMapz: user =>
            for canSee <- fuccess(isGranted(_.SeeInsight)) >>|
                user.enabled.yes.so(env.clas.api.clas.isTeacherOf(me, user.id))
            yield Option.when(canSee)(user)
    Found(user)(f)

  private def TutorReport(username: UserStr, range: String)(
      f: Context ?=> TutorFullReport => Fu[Result]
  ): EssentialAction =
    Auth { _ ?=> _ ?=>
      WithUser(username): _ =>
        Found(TutorConfig.parse(username.id, range).so(env.tutor.api.get))(f)
    }

  private def TutorPerfPage(username: UserStr, range: String, perf: PerfKey)(
      f: Context ?=> TutorFullReport => TutorPerfReport => Fu[Result]
  ): EssentialAction =
    TutorReport(username, range) { _ ?=> full =>
      full(perf).fold(Redirect(full.url.root).toFuccess)(f(full))
    }
