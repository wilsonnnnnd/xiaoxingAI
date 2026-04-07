export function interpolate(template: string, params: Record<string, string | number | undefined>) {
  return template.replace(/\{(\w+)\}/g, (_, k) => String(params[k] ?? ''))
}

export function formatLogMessage(msg: string, t: (key: string) => string) {
  if (!msg) return msg

  const rules: Array<{
    re: RegExp
    key: string
    map: (m: RegExpMatchArray) => Record<string, string | number | undefined>
  }> = [
    { re: /^🔍\s*分析邮件：(.+)$/u, key: 'log.gmail.analyze', map: m => ({ subject: m[1] }) },
    { re: /^📥\s*开始拉取邮件（查询：(.+?)，最多\s*(\d+)\s*封）/u, key: 'log.gmail.fetch_start', map: m => ({ query: m[1], max: m[2] }) },
    { re: /^✅\s*无新邮件，本轮结束/u, key: 'log.gmail.no_new', map: () => ({}) },
    { re: /^📧\s*处理邮件：(.+)$/u, key: 'log.gmail.process_email', map: m => ({ subject: m[1] }) },
    { re: /^⏭️\s*跳过低优先级 \[(.+?)\]：(.+)$/u, key: 'log.gmail.skip_low_priority', map: m => ({ priority: m[1], subject: m[2] }) },
    { re: /^✈️\s*发送 Telegram：(.+)$/u, key: 'log.gmail.send_telegram', map: m => ({ subject: m[1] }) },
    { re: /^✅\s*已发送：(.+)$/u, key: 'log.gmail.sent', map: m => ({ subject: m[1] }) },
    { re: /^📌\s*已标记已读：(.+)$/u, key: 'log.gmail.mark_read', map: m => ({ subject: m[1] }) },
    { re: /^⚠️\s*标记已读失败 \[(.+?)\]:\s*(.+)$/u, key: 'log.gmail.mark_read_failed', map: m => ({ subject: m[1], err: m[2] }) },
    { re: /^❌\s*处理失败 \[(.+?)\]:\s*(.+)$/u, key: 'log.gmail.process_fail', map: m => ({ subject: m[1], err: m[2] }) },
    { re: /^📬\s*拉取完成：共\s*(\d+)\s*封，\s*新邮件\s*(\d+)\s*封，\s*已处理\(跳过\)\s*(\d+)\s*封/u, key: 'log.gmail.fetch_done', map: m => ({ total: m[1], news: m[2], skipped: m[3] }) },
    { re: /^🚀\s*Worker 已启动，轮询间隔\s*(\d+)s/u, key: 'log.worker.started', map: m => ({ interval: m[1] }) },
    { re: /^❌\s*轮询异常:?\s*(.+)$/u, key: 'log.worker.poll_error', map: m => ({ err: m[1] }) },
    { re: /^⏹️\s*Worker 已停止/u, key: 'log.worker.stopped', map: () => ({}) },
    { re: /^▶️\s*Bot Worker 已启动/u, key: 'log.tg.bot_started', map: () => ({}) },
    { re: /^⏹️\s*Bot Worker 已停止/u, key: 'log.tg.bot_stopped', map: () => ({}) },
    { re: /^💬\s*用户:\s*(.+)$/u, key: 'log.tg.user', map: m => ({ text: m[1] }) },
    { re: /^❌\s*AI 回复失败 \[(.+?)\]:\s*(.+)$/u, key: 'log.tg.ai_reply_fail', map: m => ({ chat_id: m[1], err: m[2] }) },
    { re: /^🤖\s*Xiaoxing:\s*(.+)$/u, key: 'log.tg.assistant', map: m => ({ text: m[1] }) },
  ]

  for (const r of rules) {
    const m = msg.match(r.re)
    if (m) {
      const params = r.map(m)
      const tmpl = t(r.key)
      if (tmpl && tmpl !== r.key) {
        return interpolate(tmpl, params)
      }
      break
    }
  }

  return msg
}
