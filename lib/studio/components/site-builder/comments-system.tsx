import React, { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { MessageSquare, Send, X, Clock, Edit2, Trash2, Reply } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

export interface Comment {
  id: string
  nodeId: string
  text: string
  author: string
  authorInitials: string
  timestamp: Date
  edited?: boolean
  editedAt?: Date
  parentId?: string
  resolved?: boolean
}

interface CommentsSystemProps {
  nodeId: string
  isOpen: boolean
  onClose: () => void
  position?: { x: number; y: number }
}

export function CommentsSystem({ nodeId, isOpen, onClose, position }: CommentsSystemProps) {
  const [comments, setComments] = useState<Comment[]>([])
  const [newComment, setNewComment] = useState('')
  const [replyingTo, setReplyingTo] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editText, setEditText] = useState('')

  // Load comments from localStorage
  useEffect(() => {
    const storedComments = localStorage.getItem('sitemapComments')
    if (storedComments) {
      const parsed = JSON.parse(storedComments)
      const nodeComments = parsed.filter((c: Comment) => c.nodeId === nodeId)
      setComments(nodeComments.map((c: Comment) => ({
        ...c,
        timestamp: new Date(c.timestamp),
        editedAt: c.editedAt ? new Date(c.editedAt) : undefined
      })))
    }
  }, [nodeId])

  // Save comments to localStorage
  const saveComments = (updatedComments: Comment[]) => {
    const storedComments = localStorage.getItem('sitemapComments')
    const allComments = storedComments ? JSON.parse(storedComments) : []
    const otherComments = allComments.filter((c: Comment) => c.nodeId !== nodeId)
    const newAllComments = [...otherComments, ...updatedComments]
    localStorage.setItem('sitemapComments', JSON.stringify(newAllComments))
    setComments(updatedComments)
  }

  const handleAddComment = () => {
    if (!newComment.trim()) return

    const comment: Comment = {
      id: `comment-${Date.now()}`,
      nodeId,
      text: newComment,
      author: 'Current User',
      authorInitials: 'CU',
      timestamp: new Date(),
      parentId: replyingTo || undefined
    }

    saveComments([...comments, comment])
    setNewComment('')
    setReplyingTo(null)
  }

  const handleEditComment = (commentId: string) => {
    const comment = comments.find(c => c.id === commentId)
    if (comment) {
      setEditingId(commentId)
      setEditText(comment.text)
    }
  }

  const handleSaveEdit = () => {
    if (!editText.trim() || !editingId) return

    const updatedComments = comments.map(c => 
      c.id === editingId 
        ? { ...c, text: editText, edited: true, editedAt: new Date() }
        : c
    )
    saveComments(updatedComments)
    setEditingId(null)
    setEditText('')
  }

  const handleDeleteComment = (commentId: string) => {
    const updatedComments = comments.filter(c => c.id !== commentId && c.parentId !== commentId)
    saveComments(updatedComments)
  }

  const handleResolveComment = (commentId: string) => {
    const updatedComments = comments.map(c => 
      c.id === commentId ? { ...c, resolved: !c.resolved } : c
    )
    saveComments(updatedComments)
  }

  const getReplies = (commentId: string) => {
    return comments.filter(c => c.parentId === commentId)
  }

  const getTopLevelComments = () => {
    return comments.filter(c => !c.parentId)
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md bg-gray-900/95 backdrop-blur-xl border-gray-700 text-white">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-[#FF5500]" />
            Comments
            {comments.length > 0 && (
              <span className="text-sm text-gray-400">({comments.length})</span>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 max-h-[400px] overflow-y-auto">
          {getTopLevelComments().length === 0 ? (
            <p className="text-gray-500 text-sm text-center py-8">
              No comments yet. Be the first to add one!
            </p>
          ) : (
            getTopLevelComments().map(comment => (
              <div key={comment.id} className="space-y-2">
                <div className={`rounded-lg p-3 ${comment.resolved ? 'opacity-50' : ''}`}>
                  <div className="flex items-start gap-3">
                    <Avatar className="h-8 w-8">
                      <AvatarFallback className="bg-gradient-to-br from-purple-500 to-pink-500 text-white text-xs">
                        {comment.authorInitials}
                      </AvatarFallback>
                    </Avatar>
                    
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-white">
                            {comment.author}
                          </span>
                          <span className="text-xs text-gray-500">
                            {formatDistanceToNow(comment.timestamp, { addSuffix: true })}
                          </span>
                          {comment.edited && (
                            <span className="text-xs text-gray-600">(edited)</span>
                          )}
                        </div>
                        
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => setReplyingTo(comment.id)}
                            className="p-1 hover:bg-gray-800 rounded transition-colors"
                            title="Reply"
                          >
                            <Reply className="h-3 w-3 text-gray-400" />
                          </button>
                          <button
                            onClick={() => handleEditComment(comment.id)}
                            className="p-1 hover:bg-gray-800 rounded transition-colors"
                            title="Edit"
                          >
                            <Edit2 className="h-3 w-3 text-gray-400" />
                          </button>
                          <button
                            onClick={() => handleDeleteComment(comment.id)}
                            className="p-1 hover:bg-gray-800 rounded transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="h-3 w-3 text-gray-400" />
                          </button>
                        </div>
                      </div>
                      
                      {editingId === comment.id ? (
                        <div className="space-y-2">
                          <Textarea
                            value={editText}
                            onChange={(e) => setEditText(e.target.value)}
                            className="bg-gray-800 border-gray-700 text-white text-sm"
                            rows={2}
                          />
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              onClick={handleSaveEdit}
                              className="bg-[#FF5500] hover:bg-[#FF6600]"
                            >
                              Save
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setEditingId(null)
                                setEditText('')
                              }}
                              className="bg-white/10 border-white/20 hover:bg-white/20"
                            >
                              Cancel
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <p className="text-sm text-gray-300">{comment.text}</p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Replies */}
                {getReplies(comment.id).map(reply => (
                  <div key={reply.id} className="ml-11 rounded-lg p-3 bg-gray-800/50">
                    <div className="flex items-start gap-3">
                      <Avatar className="h-6 w-6">
                        <AvatarFallback className="bg-gradient-to-br from-blue-500 to-cyan-500 text-white text-xs">
                          {reply.authorInitials}
                        </AvatarFallback>
                      </Avatar>
                      
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-medium text-white">
                            {reply.author}
                          </span>
                          <span className="text-xs text-gray-500">
                            {formatDistanceToNow(reply.timestamp, { addSuffix: true })}
                          </span>
                        </div>
                        <p className="text-xs text-gray-300">{reply.text}</p>
                      </div>
                    </div>
                  </div>
                ))}

                {replyingTo === comment.id && (
                  <div className="ml-11 space-y-2">
                    <Textarea
                      value={newComment}
                      onChange={(e) => setNewComment(e.target.value)}
                      placeholder="Write a reply..."
                      className="bg-gray-800 border-gray-700 text-white text-sm"
                      rows={2}
                      autoFocus
                    />
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={handleAddComment}
                        className="bg-[#FF5500] hover:bg-[#FF6600]"
                      >
                        Reply
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setReplyingTo(null)
                          setNewComment('')
                        }}
                        className="bg-white/10 border-white/20 hover:bg-white/20"
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {!replyingTo && !editingId && (
          <div className="space-y-2 border-t border-gray-700 pt-4">
            <Textarea
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder="Add a comment..."
              className="bg-gray-800 border-gray-700 text-white"
              rows={3}
            />
            <Button
              onClick={handleAddComment}
              className="w-full bg-gradient-to-r from-[#FF5500] to-[#FF6600] hover:from-[#FF6600] hover:to-[#FF7700]"
              disabled={!newComment.trim()}
            >
              <Send className="h-4 w-4 mr-2" />
              Add Comment
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

// Comment indicator badge for nodes
export function CommentIndicator({ nodeId, onClick }: { nodeId: string; onClick: () => void }) {
  const [commentCount, setCommentCount] = useState(0)

  useEffect(() => {
    const storedComments = localStorage.getItem('sitemapComments')
    if (storedComments) {
      const parsed = JSON.parse(storedComments)
      const nodeComments = parsed.filter((c: Comment) => c.nodeId === nodeId)
      setCommentCount(nodeComments.length)
    }
  }, [nodeId])

  if (commentCount === 0) return null

  return (
    <button
      onClick={onClick}
      className="absolute -top-2 -left-2 flex items-center gap-1 px-2 py-1 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full text-white text-xs font-medium shadow-lg hover:scale-110 transition-transform"
    >
      <MessageSquare className="h-3 w-3" />
      {commentCount}
    </button>
  )
}
