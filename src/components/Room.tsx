import React, { useEffect, useState } from 'react';
import { useParams, Navigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { PaperUploader } from './PaperUploader';
import { PaperList } from './PaperList';
import { Annotations } from './Annotations';
import { Users, FileText, HelpCircle } from 'lucide-react';
import { summarizePaper, answerQuestion } from '../lib/gemini';

interface Paper {
  id: string;
  title: string;
  summary: string;
  created_at: string;
  full_text: string;
}

interface Room {
  id: string;
  name: string;
  created_by: string;
  created_at: string;
}

export function Room() {
  const { roomId } = useParams<{ roomId: string }>();
  const [room, setRoom] = useState<Room | null>(null);
  const [roomLoading, setRoomLoading] = useState(true);
  const [papers, setPapers] = useState<Paper[]>([]);
  const [selectedPaper, setSelectedPaper] = useState<Paper | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'summary' | 'qa' | 'collaboration'>('summary');
  const [question, setQuestion] = useState<string>('');
  const [answer, setAnswer] = useState<string>('');
  const [analyzing, setAnalyzing] = useState(false);

  const userName = localStorage.getItem('userName');
  const userColor = localStorage.getItem('userColor');

  useEffect(() => {
    if (!userName || !userColor || !roomId) return;

    fetchRoom();
    fetchPapers();
    
    // Set up real-time subscriptions
    const papersSubscription = supabase
      .channel(`papers_${roomId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'papers',
          filter: `room_id=eq.${roomId}`,
        },
        (payload) => {
          console.log('Papers change received:', payload);
          fetchPapers();
          
          // If the current selected paper was deleted, clear it
          if (payload.eventType === 'DELETE' && selectedPaper?.id === payload.old.id) {
            setSelectedPaper(null);
          }
          
          // If the current selected paper was updated, refresh it
          if (payload.eventType === 'UPDATE' && selectedPaper?.id === payload.new.id) {
            setSelectedPaper(payload.new);
          }
        }
      )
      .subscribe();

    const roomSubscription = supabase
      .channel(`room_${roomId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'rooms',
          filter: `id=eq.${roomId}`,
        },
        (payload) => {
          console.log('Room change received:', payload);
          if (payload.eventType === 'DELETE') {
            setError('This room has been deleted');
            return;
          }
          fetchRoom();
        }
      )
      .subscribe();

    // Set up polling for additional reliability
    const pollInterval = setInterval(() => {
      fetchRoom();
      fetchPapers();
      if (selectedPaper) {
        refreshSelectedPaper();
      }
    }, 1000);

    return () => {
      papersSubscription.unsubscribe();
      roomSubscription.unsubscribe();
      clearInterval(pollInterval);
    };
  }, [roomId, selectedPaper?.id]);

  async function refreshSelectedPaper() {
    if (!selectedPaper) return;
    
    try {
      const { data, error } = await supabase
        .from('papers')
        .select('*')
        .eq('id', selectedPaper.id)
        .single();

      if (error) throw error;
      if (data) {
        setSelectedPaper(data);
      }
    } catch (err) {
      console.error('Error refreshing selected paper:', err);
    }
  }

  async function fetchRoom() {
    try {
      const { data, error } = await supabase
        .from('rooms')
        .select('*')
        .eq('id', roomId)
        .single();

      if (error) throw error;
      setRoom(data);
    } catch (err: any) {
      console.error('Error fetching room:', err);
      setError(err.message);
    } finally {
      setRoomLoading(false);
    }
  }

  async function fetchPapers() {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('papers')
        .select('*')
        .eq('room_id', roomId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setPapers(data || []);
    } catch (err: any) {
      console.error('Error fetching papers:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleUpload(text: string, fileName: string) {
    setLoading(true);
    setError(null);
    try {
      const summary = await summarizePaper(text);
      
      const { data, error } = await supabase
        .from('papers')
        .insert([
          {
            title: fileName,
            summary,
            full_text: text,
            room_id: roomId,
          },
        ])
        .select()
        .single();

      if (error) throw error;
      setSelectedPaper(data);
    } catch (error: any) {
      console.error('Error processing paper:', error);
      setError(error?.message || 'Failed to process paper. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id: string) {
    try {
      const { error } = await supabase.from('papers').delete().eq('id', id);
      if (error) throw error;

      if (selectedPaper?.id === id) {
        setSelectedPaper(null);
      }
    } catch (err: any) {
      console.error('Error deleting paper:', err);
      setError(err.message);
    }
  }

  async function handleQuestionSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedPaper?.full_text || !question) return;

    setAnalyzing(true);
    setError(null);
    try {
      const response = await answerQuestion(selectedPaper.full_text, question);
      setAnswer(response);
    } catch (err: any) {
      console.error('Error answering question:', err);
      setError(err?.message || 'Failed to answer question. Please try again.');
    } finally {
      setAnalyzing(false);
    }
  }

  if (!userName || !userColor) {
    return <Navigate to="/" />;
  }

  if (roomLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500" />
      </div>
    );
  }

  if (!room) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-semibold text-gray-900">Room not found</h2>
          <p className="mt-2 text-gray-600">This room might have been deleted or never existed.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center space-x-4">
            <Users className="h-8 w-8 text-blue-500" />
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{room.name}</h1>
              <p className="text-sm text-gray-500">Created by {room.created_by}</p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: userColor }}
            />
            <span className="text-sm text-gray-600">{userName}</span>
          </div>
        </div>

        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-700">{error}</p>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="space-y-6">
            <PaperUploader onUpload={handleUpload} />
            <div className="h-[1px] bg-gray-200" />
            <PaperList
              papers={papers}
              onSelect={setSelectedPaper}
              onDelete={handleDelete}
            />
          </div>

          <div className="bg-white rounded-lg shadow">
            {loading && !papers.length ? (
              <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500" />
              </div>
            ) : selectedPaper ? (
              <div>
                <div className="border-b">
                  <nav className="flex -mb-px">
                    <button
                      onClick={() => setActiveTab('summary')}
                      className={`px-4 py-3 font-medium text-sm border-b-2 ${
                        activeTab === 'summary'
                          ? 'border-blue-500 text-blue-600'
                          : 'border-transparent text-gray-500 hover:text-gray-700'
                      }`}
                    >
                      Summary
                    </button>
                    <button
                      onClick={() => setActiveTab('qa')}
                      className={`px-4 py-3 font-medium text-sm border-b-2 ${
                        activeTab === 'qa'
                          ? 'border-blue-500 text-blue-600'
                          : 'border-transparent text-gray-500 hover:text-gray-700'
                      }`}
                    >
                      Q&A
                    </button>
                    <button
                      onClick={() => setActiveTab('collaboration')}
                      className={`px-4 py-3 font-medium text-sm border-b-2 ${
                        activeTab === 'collaboration'
                          ? 'border-blue-500 text-blue-600'
                          : 'border-transparent text-gray-500 hover:text-gray-700'
                      }`}
                    >
                      Collaboration
                    </button>
                  </nav>
                </div>

                <div className="p-6">
                  <h2 className="text-xl font-semibold mb-4">{selectedPaper.title}</h2>
                  
                  {activeTab === 'summary' && (
                    <div className="prose max-w-none">
                      <p className="text-gray-600 whitespace-pre-wrap">
                        {selectedPaper.summary}
                      </p>
                    </div>
                  )}

                  {activeTab === 'qa' && (
                    <div className="space-y-6">
                      <form onSubmit={handleQuestionSubmit} className="space-y-4">
                        <div>
                          <label htmlFor="question" className="block text-sm font-medium text-gray-700">
                            Ask a question about this paper
                          </label>
                          <div className="mt-1">
                            <input
                              type="text"
                              id="question"
                              value={question}
                              onChange={(e) => setQuestion(e.target.value)}
                              className="shadow-sm focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm border-gray-300 rounded-md"
                              placeholder="e.g., What were the main findings?"
                            />
                          </div>
                        </div>
                        <button
                          type="submit"
                          disabled={analyzing}
                          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
                        >
                          {analyzing ? 'Thinking...' : 'Ask Question'}
                        </button>
                      </form>

                      {answer && (
                        <div className="prose max-w-none">
                          <div className="flex items-center gap-2 mb-4">
                            <HelpCircle className="h-5 w-5 text-blue-500" />
                            <h3 className="text-lg font-medium">Answer</h3>
                          </div>
                          <p className="text-gray-600 whitespace-pre-wrap">
                            {answer}
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  {activeTab === 'collaboration' && selectedPaper && (
                    <Annotations
                      paperId={selectedPaper.id}
                      paperText={selectedPaper.full_text}
                      userName={userName}
                      userColor={userColor}
                    />
                  )}
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-64 text-gray-400">
                <FileText className="h-16 w-16 mb-4" />
                <p>Select a paper to start collaborating</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}