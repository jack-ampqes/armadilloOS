'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { FileStack, Loader2, AlertCircle, Upload, Trash2, FileText, Eye, X, ImagePlus } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { usePermissions } from '@/lib/usePermissions'

interface DocumentRow {
  id: string
  name: string
  title: string | null
  file_size: number | null
  content_type: string | null
  created_at: string
  thumbnail_path: string | null
}

export default function AdminDocumentsPage() {
  const router = useRouter()
  const { role } = usePermissions()
  const [documents, setDocuments] = useState<DocumentRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [viewingId, setViewingId] = useState<string | null>(null)
  const [viewUrl, setViewUrl] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [thumbnailUploadingId, setThumbnailUploadingId] = useState<string | null>(null)
  const [editingTitleId, setEditingTitleId] = useState<string | null>(null)
  const [editTitleValue, setEditTitleValue] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const thumbnailInputRefs = useRef<Record<string, HTMLInputElement | null>>({})

  const isAdmin = role === 'Admin'
  const roleKnown = role !== null

  const fetchDocuments = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/documents')
      const data = await res.json()
      if (res.ok && Array.isArray(data)) {
        setDocuments(data)
      } else {
        setError(typeof data?.error === 'string' ? data.error : 'Failed to load documents')
      }
    } catch {
      setError('Failed to load documents')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!roleKnown) return
    if (!isAdmin) {
      router.replace('/')
      return
    }
    fetchDocuments()
  }, [roleKnown, isAdmin, router])

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.type !== 'application/pdf') {
      setUploadError('Only PDF files are allowed.')
      return
    }
    setUploading(true)
    setUploadError(null)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await fetch('/api/admin/documents', {
        method: 'POST',
        body: formData,
      })
      const data = await res.json()
      if (res.ok) {
        setDocuments((prev) => [data, ...prev])
        if (fileInputRef.current) fileInputRef.current.value = ''
      } else {
        setUploadError(typeof data?.error === 'string' ? data.error : 'Upload failed')
      }
    } catch {
      setUploadError('Upload failed')
    } finally {
      setUploading(false)
    }
  }

  const handleThumbnailUpload = async (docId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      return
    }
    setThumbnailUploadingId(docId)
    try {
      const formData = new FormData()
      formData.append('thumbnail', file)
      const res = await fetch(`/api/admin/documents/${docId}/thumbnail`, {
        method: 'POST',
        body: formData,
      })
      const data = await res.json()
      if (res.ok) {
        setDocuments((prev) =>
          prev.map((d) => (d.id === docId ? { ...d, thumbnail_path: data.thumbnail_path } : d))
        )
      }
    } finally {
      setThumbnailUploadingId(null)
      const input = thumbnailInputRefs.current[docId]
      if (input) input.value = ''
    }
  }

  const saveTitle = async (docId: string) => {
    const value = editTitleValue.trim()
    setEditingTitleId(null)
    try {
      const res = await fetch(`/api/admin/documents/${docId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: value || null }),
      })
      const data = await res.json()
      if (res.ok) {
        setDocuments((prev) =>
          prev.map((d) => (d.id === docId ? { ...d, title: data.title ?? null } : d))
        )
      }
    } catch {
      // revert to previous on error
      const doc = documents.find((d) => d.id === docId)
      if (doc) setEditTitleValue(doc.title || doc.name)
    }
  }

  const openDocument = async (id: string) => {
    setViewingId(id)
    setViewUrl(null)
    try {
      const res = await fetch(`/api/admin/documents/${id}`)
      const data = await res.json()
      if (res.ok && data.viewUrl) {
        setViewUrl(data.viewUrl)
      }
    } catch {
      setViewingId(null)
    }
  }

  const closeViewer = () => {
    setViewingId(null)
    setViewUrl(null)
  }

  const deleteDocument = async (id: string) => {
    setDeletingId(id)
    try {
      const res = await fetch(`/api/admin/documents/${id}`, { method: 'DELETE' })
      if (res.ok) {
        setDocuments((prev) => prev.filter((d) => d.id !== id))
        if (viewingId === id) closeViewer()
      }
    } finally {
      setDeletingId(null)
    }
  }

  const displayTitle = (doc: DocumentRow) => doc.title || doc.name

  if (!roleKnown) {
    return (
      <div className="flex max-w-7xl items-center justify-center py-24">
        <Loader2 className="h-10 w-10 animate-spin text-white/60" />
      </div>
    )
  }

  if (!isAdmin) {
    return (
      <div className="max-w-7xl space-y-8">
        <h1 className="text-3xl font-bold text-white">Documents</h1>
        <Card className="border-amber-500/50 bg-amber-500/10">
          <CardContent className="p-6">
            <p className="text-amber-400 font-medium">You don’t have permission to view this page.</p>
            <p className="text-white/70 text-sm mt-1">Redirecting to dashboard…</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="max-w-7xl space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-white flex items-center gap-2">
          <FileStack className="h-8 w-8 text-white/80" />
          Documents
        </h1>
        <p className="mt-2 text-white/60">
          Store and view PDF documents. Only admin users can access this area.
        </p>
      </div>

      {/* Upload */}
      <div className="flex flex-wrap items-center gap-4">
        <input
          ref={fileInputRef}
          type="file"
          accept="application/pdf"
          onChange={handleUpload}
          disabled={uploading}
          className="hidden"
          id="doc-upload"
        />
        <Button
          className="border-none bg-white/10"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
        >
          {uploading ? (
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
          ) : (
            <Upload className="h-4 w-4 mr-2" />
          )}
          Upload PDF
        </Button>
        {uploadError && (
          <span className="text-red-400 text-sm flex items-center gap-1">
            <AlertCircle className="h-4 w-4" />
            {uploadError}
          </span>
        )}
      </div>

      {error && (
        <Card className="border-red-500/50 bg-red-500/10">
          <CardContent className="p-4 flex items-center gap-3">
            <AlertCircle className="h-5 w-5 text-red-400 flex-shrink-0" />
            <p className="text-red-300">{error}</p>
            <Button variant="outline" size="sm" onClick={fetchDocuments}>
              Retry
            </Button>
          </CardContent>
        </Card>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 className="h-10 w-10 animate-spin text-white/60" />
        </div>
      ) : documents.length === 0 ? (
        <div className="py-24 text-center text-white/60 flex flex-col items-center gap-2">
          <FileText className="h-16 w-16 text-white/40" />
          <p>No documents yet. Upload a PDF to get started.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {documents.map((doc) => (
            <Card key={doc.id} className="overflow-hidden border-white/20 flex flex-col">
              {/* Thumbnail area */}
              <div className="relative aspect-[4/3] bg-white/5 flex items-center justify-center group">
                {doc.thumbnail_path ? (
                  <img
                    src={`/api/admin/documents/${doc.id}/thumbnail`}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <FileText className="h-16 w-16 text-white/30" />
                )}
                <input
                  ref={(el) => {
                    thumbnailInputRefs.current[doc.id] = el
                  }}
                  type="file"
                  accept="image/jpeg,image/png,image/gif,image/webp"
                  onChange={(e) => handleThumbnailUpload(doc.id, e)}
                  className="hidden"
                  id={`thumb-${doc.id}`}
                />
                <label
                  htmlFor={`thumb-${doc.id}`}
                  className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                >
                  {thumbnailUploadingId === doc.id ? (
                    <Loader2 className="h-8 w-8 animate-spin text-white" />
                  ) : (
                    <span className="flex items-center gap-2 rounded-lg bg-white/20 px-3 py-2 text-sm text-white">
                      <ImagePlus className="h-4 w-4" />
                      {doc.thumbnail_path ? 'Change' : 'Add'} thumbnail
                    </span>
                  )}
                </label>
              </div>
              <CardContent className="p-4 flex-1 flex flex-col">
                {/* Title */}
                <div className="min-h-[1rem] flex items-center">
                  {editingTitleId === doc.id ? (
                    <input
                      type="text"
                      value={editTitleValue}
                      onChange={(e) => setEditTitleValue(e.target.value)}
                      onBlur={() => saveTitle(doc.id)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') saveTitle(doc.id)
                        if (e.key === 'Escape') {
                          setEditingTitleId(null)
                          setEditTitleValue(displayTitle(doc))
                        }
                      }}
                      className="flex-1 bg-white/10 border border-white/20 rounded px-2 py-1 text-white text-sm focus:outline-none focus:ring-1 focus:ring-white/40"
                      autoFocus
                    />
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setEditingTitleId(doc.id)
                        setEditTitleValue(displayTitle(doc))
                      }}
                      className="text-left text-white font-medium truncate w-full hover:underline"
                    >
                      {displayTitle(doc)}
                    </button>
                  )}
                </div>
                {/* Actions */}
                <div className="flex items-center gap-2 mt-3 pt-3">
                  <Button
                    variant="outline"
                    size="icon"
                    className="flex-1 border-none hover:bg-white/20"
                    onClick={() => openDocument(doc.id)}
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    className="flex-1 border-none text-red-400 hover:text-red-300 border-none hover:bg-red-500/10"
                    onClick={() => deleteDocument(doc.id)}
                    disabled={deletingId === doc.id}
                  >
                    {deletingId === doc.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Embedded PDF viewer modal */}
      {viewingId && (
        <div className="fixed inset-0 z-50 flex flex-col bg-black/90">
          <div className="flex items-center justify-between px-4 py-3 bg-[#181818] border-b border-white/20">
            <span className="text-white font-medium">Document viewer</span>
            <Button variant="outline" size="icon" className="border-none hover:bg-white/10" onClick={closeViewer}>
              <X className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex-1 min-h-0 p-4">
            {viewUrl ? (
              <iframe
                src={viewUrl}
                title="PDF document"
                className="w-full h-full rounded-lg bg-white"
              />
            ) : (
              <div className="flex items-center justify-center h-full">
                <Loader2 className="h-10 w-10 animate-spin text-white/60" />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
