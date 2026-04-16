export type LegalLang = 'en' | 'zh'

export interface LegalSection {
  title: string
  paragraphs?: string[]
  bullets?: string[]
}

export interface LegalDoc {
  title: string
  effectiveDate: string
  sections: LegalSection[]
}

const effectiveDate = new Date().toLocaleDateString();
const contactEmail = 'wilson.ding.wm@gmail.com'

export function getPrivacyPolicy(lang: LegalLang): LegalDoc {
  if (lang === 'zh') {
    return {
      title: '隐私政策',
      effectiveDate,
      sections: [
        {
          title: '1. 概述',
          paragraphs: [
            '本隐私政策说明小星 AI（“我们”）在你使用本服务时如何收集、使用与保护你的信息。',
          ],
        },
        {
          title: '2. Google 授权与 Gmail 访问',
          paragraphs: [
            '当你启用 Gmail 功能时，我们会通过 Google OAuth 请求你的授权。',
            '授权后，服务会根据你配置的 Gmail 搜索语句（query）读取匹配的邮件，用于分析与通知。',
          ],
          bullets: [
            '我们可能会读取邮件主题、发件人、时间与邮件正文内容，以便完成分析与生成通知。',
            '我们不会无差别读取你的整个邮箱；读取范围由你配置的 query 决定。',
            '我们不会下载或保存附件用于分析。',
          ],
        },
        {
          title: '3. 数据最小化与不保存邮件内容',
          paragraphs: [
            '我们不会保存你的 Gmail 邮件正文内容。邮件内容仅用于即时分析与向你发送通知。',
            '为保障服务正常运行与去重，我们可能会保存必要的最小元数据，例如邮件 ID、处理状态、时间戳，以及你的配置（轮询间隔、query 等）。',
            '我们会将你的 Google OAuth Token 加密存储在数据库中，以便服务代表你访问 Gmail。你可以随时在 Google 账号安全设置中撤销授权。',
          ],
        },
        {
          title: '4. 我们如何使用信息',
          bullets: [
            '分析未读邮件并生成结构化摘要/标签，用于通知展示。',
            '通过 Telegram 向你推送通知或草稿预览（如你已配置 Telegram）。',
            '提供账户登录、权限隔离、故障排查与安全防护。',
          ],
        },
        {
          title: '5. 分享与第三方',
          paragraphs: [
            '我们不会出售你的个人信息。我们仅在提供服务所必需的范围内，或在法律要求下，与第三方共享必要信息。',
          ],
        },
        {
          title: '6. Google API 数据政策',
          paragraphs: [
            '小星 AI 对从 Google APIs 获得的信息的使用与转移，遵循 Google API Services User Data Policy（包括 Limited Use 要求）。',
          ],
        },
        {
          title: '7. 安全',
          paragraphs: [
            '我们采取合理的安全措施保护你的信息，包括对 OAuth Token 进行加密存储。但任何传输或存储方式都无法保证绝对安全。',
          ],
        },
        {
          title: '8. 你的选择',
          bullets: [
            '你可以在 Google 账号安全设置中随时撤销 Gmail 授权。',
            '你可以在 Gmail 功能页停止轮询。',
            '你可以请求管理员删除你的账户数据。',
          ],
        },
        {
          title: '9. 联系方式',
          paragraphs: [`如对本隐私政策有疑问，请联系：${contactEmail}`],
        },
      ],
    }
  }

  return {
    title: 'Privacy Policy',
    effectiveDate,
    sections: [
      {
        title: '1. Overview',
        paragraphs: [
          'This Privacy Policy explains how Xiaoxing AI ("we", "us", "our") collects, uses, and protects your information when you use the Service.',
        ],
      },
      {
        title: '2. Google Authorization and Gmail Access',
        paragraphs: [
          'If you enable the Gmail feature, you will be asked to authorize access via Google OAuth.',
          'After authorization, the Service reads Gmail messages that match your configured Gmail search query for analysis and notifications.',
        ],
        bullets: [
          'We may access email subject, sender, timestamp, and message content required to analyze and generate notifications.',
          'We do not access your entire mailbox indiscriminately; access is limited by the query you configure.',
          'We do not download or store attachments for analysis.',
        ],
      },
      {
        title: '3. Data Minimization and No Email Content Storage',
        paragraphs: [
          'We do not store the body/content of your Gmail messages. Message content is processed only to generate analysis and notifications.',
          'To operate the Service reliably and prevent duplicate processing, we may store minimal metadata such as message IDs, processing status, timestamps, and your configuration (poll interval, query, etc.).',
          'We store your Google OAuth tokens encrypted so the Service can access Gmail on your behalf. You can revoke access at any time in your Google Account security settings.',
        ],
      },
      {
        title: '4. How We Use Data',
        bullets: [
          'Analyze unread emails and generate structured summaries/labels for notification display.',
          'Send notifications or draft previews via Telegram (if you configure Telegram).',
          'Operate and secure the Service (authentication, isolation, debugging, abuse prevention).',
        ],
      },
      {
        title: '5. Sharing',
        paragraphs: [
          'We do not sell your personal data. We share data only as necessary to provide the Service or comply with legal obligations.',
        ],
      },
      {
        title: '6. Google API Services User Data Policy',
        paragraphs: [
          "Xiaoxing AI's use and transfer of information received from Google APIs adheres to the Google API Services User Data Policy, including the Limited Use requirements.",
        ],
      },
      {
        title: '7. Security',
        paragraphs: [
          'We use reasonable security practices, including encrypting OAuth tokens at rest. However, no method of transmission or storage is 100% secure.',
        ],
      },
      {
        title: '8. Your Choices',
        bullets: [
          'Revoke Gmail access any time from your Google Account security settings.',
          'Stop Gmail polling from the Gmail feature page.',
          'Request account data deletion from the system administrator.',
        ],
      },
      {
        title: '9. Contact',
        paragraphs: [`If you have questions about this Privacy Policy, contact: ${contactEmail}`],
      },
    ],
  }
}

export function getTermsOfService(lang: LegalLang): LegalDoc {
  if (lang === 'zh') {
    return {
      title: '服务条款',
      effectiveDate,
      sections: [
        {
          title: '1. 条款适用',
          paragraphs: [
            '本服务条款（“条款”）适用于你对小星 AI 的访问与使用。使用本服务即表示你同意本条款。',
          ],
        },
        {
          title: '2. Gmail 功能与 Google 授权',
          paragraphs: [
            '若你启用 Gmail 功能，你需要通过 Google OAuth 授权。',
            '你理解并同意：服务将读取符合你配置的 Gmail 搜索语句（query）的邮件，用于分析与通知。',
          ],
        },
        {
          title: '3. 可接受使用',
          bullets: [
            '不得将本服务用于违法用途或侵犯他人权益。',
            '不得绕过鉴权或尝试访问其他用户的数据。',
            '不得对服务进行滥用（例如恶意刷请求、干扰运行）。',
          ],
        },
        {
          title: '4. 隐私与数据',
          paragraphs: ['我们如何处理数据请参见《隐私政策》。'],
        },
        {
          title: '5. 服务可用性',
          paragraphs: [
            '我们可能随时修改、暂停或终止服务，不保证服务持续不间断可用。',
          ],
        },
        {
          title: '6. 免责声明',
          paragraphs: [
            '本服务包含 AI 生成的分析与草稿，输出可能存在错误或不准确。你应在采取行动或发送邮件前自行核对内容。',
          ],
        },
        {
          title: '7. 责任限制',
          paragraphs: [
            '在法律允许的最大范围内，我们不对因使用本服务导致的间接、附带、特殊或后果性损失承担责任。',
          ],
        },
        {
          title: '8. 终止',
          paragraphs: [
            '如你违反本条款，我们可暂停或终止你的访问权限。你也可以随时停止使用本服务，并在 Google 账号中撤销 Gmail 授权。',
          ],
        },
        {
          title: '9. 联系方式',
          paragraphs: [`如对本条款有疑问，请联系：${contactEmail}`],
        },
      ],
    }
  }

  return {
    title: 'Terms of Service',
    effectiveDate,
    sections: [
      {
        title: '1. Agreement',
        paragraphs: [
          'These Terms of Service ("Terms") govern your access to and use of Xiaoxing AI (the "Service"). By using the Service, you agree to these Terms.',
        ],
      },
      {
        title: '2. Google Authorization (Gmail Feature)',
        paragraphs: [
          'If you enable the Gmail feature, you must authorize access via Google OAuth.',
          'You understand the Service will access Gmail messages matching your configured search query to analyze and notify you.',
        ],
      },
      {
        title: '3. Acceptable Use',
        bullets: [
          "Do not use the Service for illegal activities or to violate others' rights.",
          "Do not attempt to bypass authentication or access other users' data.",
          'Do not abuse the Service (excessive requests, automation, interference).',
        ],
      },
      {
        title: '4. Data and Privacy',
        paragraphs: ['Please review the Privacy Policy for how data is handled.'],
      },
      {
        title: '5. Service Availability',
        paragraphs: ['We may modify, suspend, or discontinue the Service at any time. We do not guarantee uninterrupted operation.'],
      },
      {
        title: '6. Disclaimers',
        paragraphs: [
          'The Service provides AI-generated analyses and drafts for convenience. Outputs may be inaccurate. You are responsible for verifying content before acting on it or sending messages.',
        ],
      },
      {
        title: '7. Limitation of Liability',
        paragraphs: [
          'To the maximum extent permitted by law, we are not liable for indirect, incidental, special, or consequential damages, or for loss of data, business, or profits arising from your use of the Service.',
        ],
      },
      {
        title: '8. Termination',
        paragraphs: [
          'We may suspend or terminate your access if you violate these Terms. You may stop using the Service at any time and can revoke Gmail access from your Google Account.',
        ],
      },
      {
        title: '9. Contact',
        paragraphs: [`For questions about these Terms, contact: ${contactEmail}`],
      },
    ],
  }
}
