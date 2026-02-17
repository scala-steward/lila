package lila.tutor

import lila.common.{ Chronometer, LilaScheduler, Uptime }
import lila.core.perf.UserWithPerfs
import lila.db.dsl.{ *, given }
import lila.memo.CacheApi

final class TutorApi(
    colls: TutorColls,
    queue: TutorQueue,
    builder: TutorBuilder,
    cacheApi: CacheApi
)(using Executor, Scheduler)(using mode: play.api.Mode):

  import TutorBsonHandlers.given
  import TutorFullReport.Availability

  export queue.fetchStatus as queueStatus

  def availability(user: UserWithPerfs): Fu[TutorFullReport.Availability] =
    findLatest(user.id).flatMap:
      case Some(report) => fuccess(Availability.Available(report))
      case None =>
        builder.eligiblePerfKeysOf(user) match
          case Nil => fuccess(Availability.InsufficientGames)
          case _ => queueStatus(user.id).map(Availability.Empty(_))

  private val previewProjection = $doc(
    TutorFullReport.F.config -> true,
    TutorFullReport.F.at -> true,
    s"${TutorFullReport.F.perfs}.perf" -> true,
    s"${TutorFullReport.F.perfs}.stats" -> true
  )
  def previews(userId: UserId): Fu[List[TutorFullReport.Preview]] = colls.report:
    _.find($doc(TutorFullReport.F.user -> userId), previewProjection.some)
      .sort($sort.desc(TutorFullReport.F.at))
      .cursor[TutorFullReport.Preview]()
      .list(16)

  def get(config: TutorConfig): Fu[Option[TutorFullReport]] = cache.get(config)

  private val initialDelay = if mode.isProd then 1.minute else 5.seconds
  // LilaScheduler("TutorApi", _.Every(1.second), _.AtMost(10.seconds), _.Delay(initialDelay))(pollQueue)

  private def pollQueue = queue.next.flatMap: items =>
    lila.mon.tutor.parallelism.update(items.size)
    items.sequentiallyVoid: next =>
      next.startedAt.fold(buildThenRemoveFromQueue(next.config)): started =>
        val expired =
          started.isBefore(nowInstant.minusSeconds(builder.maxTime.toSeconds.toInt)) ||
            started.isBefore(Uptime.startedAt)
        expired.so:
          lila.mon.tutor.buildTimeout.increment()
          queue.remove(next.config.user)

  // we only wait for queue.start
  // NOT for builder
  private def buildThenRemoveFromQueue(config: TutorConfig) =
    val chrono = Chronometer.start
    logger.info(s"Start ${config.user}")
    for _ <- queue.start(config.user)
    yield builder(config).foreach: report =>
      logger.info(s"${report.id} in ${chrono().seconds} seconds")
      cache.put(config, fuccess(report.some))
      queue.remove(config.user)

  private val cache = cacheApi[TutorConfig, Option[TutorFullReport]](256, "tutor.report"):
    _.expireAfterAccess(if mode.isProd then 2 minutes else 1 second).buildAsyncFuture(findByConfig)

  private def findByConfig(config: TutorConfig) = colls.report:
    _.find($id(config.id)).one[TutorFullReport]

  private def findLatest(userId: UserId) = colls.report:
    _.find($doc(TutorFullReport.F.user -> userId))
      .sort($sort.desc(TutorFullReport.F.at))
      .one[TutorFullReport]
