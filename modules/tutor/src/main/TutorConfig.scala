package lila.tutor

import java.time.LocalDate
import java.time.format.DateTimeFormatter
import play.api.mvc.Call
import lila.common.LilaOpeningFamily

case class TutorConfig(user: UserId, from: LocalDate, to: LocalDate):

  val rangeStr = s"${TutorConfig.format(from)}_${TutorConfig.format(to)}"

  val id = s"$user:$rangeStr"

  object url:
    def root = routes.Tutor.report(user, rangeStr)
    def perf(pk: PerfKey) = routes.Tutor.perf(user, rangeStr, pk)
    def angle(pk: PerfKey, a: Angle): Call = routes.Tutor.angle(user, rangeStr, pk, a)
    def angle(pk: PerfKey, a: Option[Angle]): Call = a.fold(perf(pk))(angle(pk, _))
    def opening(pk: PerfKey, color: Color, opening: LilaOpeningFamily): Call =
      routes.Tutor.opening(user, rangeStr, pk, color, opening.key.value)

object TutorConfig:

  def full(user: UserId) = TutorConfig(user, minFrom, LocalDate.now)

  def parse(user: UserId, urlFragment: String): Option[TutorConfig] =
    urlFragment.split("_") match
      case Array(fromStr, toStr) =>
        for
          from <- parseDate(fromStr)
          to <- parseDate(toStr)
        yield TutorConfig(user, from, to)
      case _ => none

  private def parseDate(str: String): Option[LocalDate] =
    scala.util.Try(LocalDate.parse(str, dateFormatter)).toOption

  private val minFrom = lila.insight.minDate.date

  private val dateFormatter = DateTimeFormatter.ofPattern("yyyy-MM-dd")
  def format(date: LocalDate) = date.format(dateFormatter)

  object form:

    import play.api.data.Form
    import play.api.data.Forms.*
    import lila.common.Form.ISODate

    def dates(user: UserId) = Form:
      mapping(
        "from" -> ISODate.mapping.verifying(
          s"From date must be after ${format(minFrom)}",
          _.isAfter(minFrom)
        ),
        "to" -> ISODate.mapping.verifying(
          "Date cannot be in the future",
          _.isBefore(LocalDate.now.plusDays(1))
        )
      )((f, t) => TutorConfig(user, f, t))(config => Some(config.from, config.to))
        .verifying(
          "From date must be before to date",
          config => config.from.isBefore(config.to)
        )
