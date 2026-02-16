package controllers

import play.api.mvc.*

import lila.app.{ *, given }
import lila.common.LilaOpeningFamily
import lila.core.perf.UserWithPerfs
import lila.rating.PerfType
import lila.tutor.{ TutorFullReport, TutorPerfReport, TutorQueue, TutorConfig }

final class Tutor(env: Env) extends LilaController(env):

  def home = Auth { _ ?=> me ?=>
    Redirect(routes.Tutor.user(me.username))
  }

  def user(username: UserStr) = Auth { _ ?=> _ ?=>
    Found(allowedUser(username)): user =>
      for
        withPerfs <- env.user.api.withPerfs(user)
        av <- env.tutor.api.availability(withPerfs)
        res <- av match
          case TutorFullReport.InsufficientGames =>
            BadRequest.page(views.tutor.home.empty.insufficientGames(username.id))
          case TutorFullReport.Empty(in: TutorQueue.InQueue) =>
            for
              waitGames <- env.tutor.queue.waitingGames(user.id)
              page <- renderPage(views.tutor.home.empty.queued(in, withPerfs, waitGames))
            yield Accepted(page)
          case TutorFullReport.Empty(_) => Accepted.page(views.tutor.home.empty.start(user.id))
          case TutorFullReport.Available(r) => Ok.page(views.tutor.home(r))
      yield res
  }

  def report(username: UserStr, range: String) = TutorReport(username, range) { _ ?=> full =>
    Ok.page(views.tutor.home(full))
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

  def compute(username: UserStr) = TutorPageAvailability(username) { _ ?=> _ =>
    ???
    // env.tutor.api.request(user, availability).inject(redirHome(user))
  }

  private def allowedUser(username: UserStr)(using me: Me): Fu[Option[lila.core.user.User]] =
    if me.is(username) then fuccess(me.some)
    else
      env.user.api
        .byId(username.id)
        .flatMapz: user =>
          for canSee <- fuccess(isGranted(_.SeeInsight)) >>|
              user.enabled.yes.so(env.clas.api.clas.isTeacherOf(me, user.id))
          yield Option.when(canSee)(user)

  private def TutorPageAvailability(
      username: UserStr
  )(f: Context ?=> UserWithPerfs => TutorFullReport.Availability => Fu[Result]): EssentialAction =
    Auth { _ ?=> me ?=>
      Found(allowedUser(username)): user =>
        for
          withPerfs <- env.user.api.withPerfs(user)
          av <- env.tutor.api.availability(withPerfs)
          res <- f(withPerfs)(av)
        yield res
    }

  private def TutorReport(username: UserStr, range: String)(
      f: Context ?=> TutorFullReport => Fu[Result]
  ): EssentialAction =
    Auth { _ ?=> _ ?=>
      Found(allowedUser(username)): _ =>
        Found(TutorConfig.parse(username.id, range).so(env.tutor.api.get))(f)
    }

  private def TutorPerfPage(username: UserStr, range: String, perf: PerfKey)(
      f: Context ?=> TutorFullReport => TutorPerfReport => Fu[Result]
  ): EssentialAction =
    TutorReport(username, range) { _ ?=> full =>
      full(perf).fold(Redirect(full.url.root).toFuccess)(f(full))
    }
