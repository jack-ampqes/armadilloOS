'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { FileStack, Loader2, AlertCircle, Upload, Trash2, FileText, Eye } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { usePermissions } from '@/lib/usePermissions'

interface DocumentRow {
  id: string
  name: string
  file_size: number | null
  content_type: string | null
  created_at: string
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
  const fileInputRef = useRef<HTMLInputElement>(null)

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

  const formatSize = (bytes: number | null) => {
    if (bytes == null) return '—'
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  const formatDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleDateString(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short',
      })
    } catch {
      return iso
    }
  }

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
          className="hidden border-none"
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

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-10 w-10 animate-spin text-white/60" />
            </div>
          ) : documents.length === 0 ? (
            <div className="py-12 text-center text-white/60 flex flex-col items-center gap-2">
              <FileText className="h-12 w-12 text-white/40" />
              <p>No documents yet. Upload a PDF to get started.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-white/80 pl-4">Name</TableHead>
                  <TableHead className="text-white/80">Size</TableHead>
                  <TableHead className="text-white/80">Uploaded</TableHead>
                  <TableHead className="text-white/80 w-[180px]"> </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {documents.map((doc) => (
                  <TableRow key={doc.id}>
                    <TableCell className="text-white font-medium border-none pl-4">
                      <button
                        type="button"
                        onClick={() => openDocument(doc.id)}
                        className="text-left hover:underline focus:underline"
                      >
                        {doc.name}
                      </button>
                    </TableCell>
                    <TableCell className="text-white/80">{formatSize(doc.file_size)}</TableCell>
                    <TableCell className="text-white/60 text-sm">{formatDate(doc.created_at)}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="icon"
                          className="text-white hover:text-white/80 border-none"
                          onClick={() => openDocument(doc.id)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="outline"
                          size="icon"
                          className="text-red-400 hover:text-red-300 border-none hover:bg-red-500/10"
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
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Embedded PDF viewer modal */}
      {viewingId && (
        <div className="fixed inset-0 z-50 flex flex-col bg-black/90">
          <div className="flex items-center justify-between px-4 py-3 bg-[#181818] border-b border-white/20">
            <span className="text-white font-medium">Document viewer</span>
            <Button variant="outline" size="sm" onClick={closeViewer}>
              Close
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
