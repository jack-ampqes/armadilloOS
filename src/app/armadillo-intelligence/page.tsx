'use client'

import { FormEvent, KeyboardEvent, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Inconsolata } from 'next/font/google'
import { Loader2, Sparkles, Send } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { usePermissions } from '@/lib/usePermissions'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

type Message = {
  role: 'user' | 'assistant'
  content: string
}

const MAX_TEXTAREA_HEIGHT = 180
const inconsolata = Inconsolata({ subsets: ['latin'] })

export default function ArmadilloIntelligencePage() {
  const router = useRouter()
  const { role } = usePermissions()
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content:
        'Armadillo Intelligence is ready. Ask about inventory, history, orders, manufacturer orders, customers, users, or documents.',
    },
  ])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, submitting])

  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, MAX_TEXTAREA_HEIGHT)}px`
  }, [input])

  if (role && role !== 'Admin') {
    router.replace('/')
    return null
  }

  const doSend = async (prompt: string) => {
    const nextMessages: Message[] = [...messages, { role: 'user', content: prompt }]
    setMessages(nextMessages)
    setInput('')
    setSubmitting(true)
    setError(null)

    try {
      const response = await fetch('/api/armadillo-intelligence/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: nextMessages }),
      })

      const payload = await response.json().catch(() => ({}))
      if (!response.ok) {
        const message = typeof payload?.error === 'string' ? payload.error : 'Failed to send message.'
        const hint = typeof payload?.hint === 'string' ? ` ${payload.hint}` : ''
        throw new Error(`${message}${hint}`)
      }

      const reply = typeof payload?.message === 'string' ? payload.message : 'No response returned.'
      setMessages((current) => [...current, { role: 'assistant', content: reply }])
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Something went wrong.'
      setError(message)
    } finally {
      setSubmitting(false)
    }
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    const prompt = input.trim()
    if (!prompt || submitting) return
    await doSend(prompt)
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      const prompt = input.trim()
      if (!prompt || submitting) return
      void doSend(prompt)
    }
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 md:px-8 md:py-10">
      <Card className="bg-[#181818] border-white/20 text-white">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl md:text-2xl">
            <Sparkles className="w-6 h-6 text-[#ffdc6b]" />
            Armadillo Intelligence
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="h-[460px] overflow-y-auto rounded-lg border border-white/15 bg-black/20 p-4 space-y-3">
            {messages.map((message, index) => (
              <div
                key={`${message.role}-${index}`}
                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[85%] md:max-w-[75%] rounded-2xl px-4 py-2.5 text-lg leading-relaxed shadow-sm ${
                    message.role === 'user'
                      ? 'bg-[#ffdc6b] text-black rounded-br-sm whitespace-pre-wrap text-lg'
                      : `bg-white/10 text-white rounded-bl-sm armadillo-markdown text-base ${inconsolata.className}`
                  }`}
                >
                  {message.role === 'assistant' ? (
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      components={{
                        p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                        ul: ({ children }) => <ul className="list-disc pl-5 mb-2 last:mb-0 space-y-1">{children}</ul>,
                        ol: ({ children }) => <ol className="list-decimal pl-5 mb-2 last:mb-0 space-y-1">{children}</ol>,
                        li: ({ children }) => <li className="marker:text-white/60">{children}</li>,
                        strong: ({ children }) => <strong className="font-semibold text-white">{children}</strong>,
                        em: ({ children }) => <em className="italic">{children}</em>,
                        h1: ({ children }) => <h1 className="text-base font-semibold mb-2">{children}</h1>,
                        h2: ({ children }) => <h2 className="text-base font-semibold mb-2">{children}</h2>,
                        h3: ({ children }) => <h3 className="text-sm font-semibold mb-2">{children}</h3>,
                        a: ({ href, children }) => (
                          <a
                            href={href}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[#ffdc6b] underline underline-offset-2 hover:text-[#ffdc6b]/80"
                          >
                            {children}
                          </a>
                        ),
                        code: ({ className, children, ...props }) => {
                          const isInline = !className
                          if (isInline) {
                            return (
                              <code
                                className="rounded bg-black/40 px-1 py-0.5 text-[0.8125rem] font-mono text-white"
                                {...props}
                              >
                                {children}
                              </code>
                            )
                          }
                          return (
                            <code className={`${className ?? ''} font-mono text-[0.8125rem]`} {...props}>
                              {children}
                            </code>
                          )
                        },
                        pre: ({ children }) => (
                          <pre className="mb-2 last:mb-0 overflow-x-auto rounded-lg bg-black/40 p-3 text-xs">
                            {children}
                          </pre>
                        ),
                        blockquote: ({ children }) => (
                          <blockquote className="border-l-2 border-white/30 pl-3 italic text-white/80 mb-2 last:mb-0">
                            {children}
                          </blockquote>
                        ),
                        hr: () => <hr className="my-3 border-white/15" />,
                        table: ({ children }) => (
                          <div className="overflow-x-auto mb-2 last:mb-0">
                            <table className="min-w-full text-xs border border-white/15">{children}</table>
                          </div>
                        ),
                        th: ({ children }) => (
                          <th className="border border-white/15 px-2 py-1 text-left font-semibold">{children}</th>
                        ),
                        td: ({ children }) => <td className="border border-white/15 px-2 py-1 align-top">{children}</td>,
                      }}
                    >
                      {message.content}
                    </ReactMarkdown>
                  ) : (
                    <span className="whitespace-pre-wrap">{message.content}</span>
                  )}
                </div>
              </div>
            ))}
            {submitting && (
              <div className="flex justify-start">
                <div className="bg-white/10 text-white rounded-2xl rounded-bl-sm px-4 py-2.5 text-sm flex items-center gap-2">
                  <span className="typing-dot" />
                  <span className="typing-dot" style={{ animationDelay: '120ms' }} />
                  <span className="typing-dot" style={{ animationDelay: '240ms' }} />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {error && (
            <div className="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-200">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div
              className="flex items-end gap-2 rounded-full border border-white/20 bg-black/40 pl-4 pr-2 py-2 focus-within:border-[#ffdc6b]/60 focus-within:shadow-[0_0_0_3px_rgba(255,220,107,0.15)] transition-colors"
            >
              <Textarea
                ref={textareaRef}
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Message Armadillo Intelligence..."
                rows={1}
                className="flex-1 min-h-[24px] max-h-[180px] resize-none border-0 bg-transparent px-0 py-1.5 text-sm text-white placeholder:text-white/40 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
              />
              <button
                type="submit"
                disabled={submitting || !input.trim()}
                aria-label="Send message"
                className="flex-shrink-0 flex items-center justify-center w-9 h-9 rounded-full bg-[#ffdc6b] text-black hover:bg-[#ffdc6b]/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                {submitting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
              </button>
            </div>
          </form>
        </CardContent>
      </Card>

      <style jsx global>{`
        .typing-dot {
          display: inline-block;
          width: 6px;
          height: 6px;
          border-radius: 999px;
          background: rgba(255, 255, 255, 0.7);
          animation: typing-bounce 1.1s infinite ease-in-out;
        }
        @keyframes typing-bounce {
          0%, 80%, 100% {
            transform: translateY(0);
            opacity: 0.5;
          }
          40% {
            transform: translateY(-3px);
            opacity: 1;
          }
        }
      `}</style>
    </div>
  )
}
