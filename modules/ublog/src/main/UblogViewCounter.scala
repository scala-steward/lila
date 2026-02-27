package lila.ublog

import bloomfilter.mutable.BloomFilter

import lila.db.dsl.{ *, given }
import lila.memo.ViewerCount.*
import lila.ui.Context

final class UblogViewCounter(colls: UblogColls)(using Executor):

  private val bloomFilter = BloomFilter[String](
    numberOfItems = 300_000,
    falsePositiveRate = 0.001
  )

  def apply(post: UblogPost)(using ctx: Context): UblogPost =
    if post.live then
      post.copy(views =
        val key = s"${post.id}${encode(makeViewer(ctx.req, ctx.userId))}"
        if bloomFilter.mightContain(key) then post.views
        else
          bloomFilter.add(key)
          lila.mon.ublog.view.increment()
          colls.post.incFieldUnchecked($id(post.id), "views")
          post.views + 1)
    else post
