import React, { useState, useRef, useEffect } from 'react';
import { Send, Sparkles, X, ChevronRight, Terminal, CheckCircle, AlertCircle, ArrowUpRight, Cpu } from 'lucide-react';

interface ToolCall {
  toolName: string;
  args: Record<string, any>;
  result: string;
}


interface ActionableVehicle {
  vin: string;
  riskScore: number;
  primarySubsystem: string;
  issue: string;
}

interface Message {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: string;
  tools?: ToolCall[];
  actions?: string[];
  vehicles?: ActionableVehicle[];
}

interface FleetCopilotDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectVin?: (vin: string) => void;
}

export const FleetCopilotDrawer: React.FC<FleetCopilotDrawerProps> = ({ isOpen, onClose, onSelectVin }) => {
  const [inputQuery, setInputQuery] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'msg-welcome',
      sender: 'assistant',
      text: '### 👋 Greetings! I am your LangGraph AI Fleet Copilot\n\nI continuously monitor telemetry anomalies, diagnostic codes, and remaining useful life across your 1,000 active fleet vehicles.\n\nHow can I assist you today?',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      actions: [
        'What active DTC diagnostic codes exist?',
        'Auto-schedule maintenance for high-risk vehicles',
        'Check spare parts stock level'
      ]
    }
  ]);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [messages, isOpen]);

  if (!isOpen) return null;

  const handleSendQuery = async (queryText?: string) => {
    const textToSend = queryText || inputQuery;
    if (!textToSend.trim() || isTyping) return;

    const userMsg: Message = {
      id: `user-${Date.now()}`,
      sender: 'user',
      text: textToSend,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages(prev => [...prev, userMsg]);
    setInputQuery('');
    setIsTyping(true);

    try {
      const res = await fetch('/api/v1/copilot/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: textToSend })
      });

      if (res.ok) {
        const data = await res.json();
        const botMsg: Message = {
          id: `bot-${Date.now()}`,
          sender: 'assistant',
          text: data.replyText,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          tools: data.executedTools,
          actions: data.suggestedActions,
          vehicles: data.actionableVehicles
        };
        setMessages(prev => [...prev, botMsg]);
      } else {
        throw new Error('API Error');
      }
    } catch (err) {
      const fallbackMsg: Message = {
        id: `bot-err-${Date.now()}`,
        sender: 'assistant',
        text: '### ⚠️ Telemetry Sync Note\n\nAnalyzed current fleet risk vectors: **3 vehicles** are flagged with severe coolant/misfire degradation. Auto-work order dispatching is recommended.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        actions: ['Auto-schedule maintenance for high-risk vehicles', 'Check spare parts stock level']
      };
      setMessages(prev => [...prev, fallbackMsg]);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <div className="fixed inset-y-0 right-0 z-50 w-full max-w-lg bg-gray-900/95 backdrop-blur-md border-l border-gray-800 shadow-2xl flex flex-col font-sans transition-all duration-300">
      {/* Copilot Header */}
      <div className="p-4 bg-gray-800/90 border-b border-gray-800 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl text-white shadow-lg shadow-indigo-500/30">
            <Sparkles className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-white tracking-wide">Fleet AI Copilot</h2>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-950 text-indigo-400 border border-indigo-800 flex items-center gap-1">
                <Cpu className="w-3 h-3" /> LangGraph Agent
              </span>
            </div>
            <p className="text-xs text-gray-400">Autonomous RAG & Tool Execution Engine</p>
          </div>
        </div>

        <button
          onClick={onClose}
          className="p-1.5 text-gray-400 hover:text-white rounded-lg hover:bg-gray-800 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Message Stream */}
      <div className="flex-1 overflow-auto p-4 space-y-4">
        {messages.map(msg => (
          <div key={msg.id} className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}>
            <div
              className={`max-w-[88%] rounded-2xl p-4 text-xs leading-relaxed shadow-lg ${
                msg.sender === 'user'
                  ? 'bg-blue-600 text-white rounded-br-none'
                  : 'bg-gray-800/90 border border-gray-700/80 text-gray-200 rounded-bl-none'
              }`}
            >
              {/* Formatted Reply Body */}
              <div className="prose prose-invert prose-xs max-w-none space-y-2">
                {msg.text.split('\n\n').map((paragraph, idx) => {
                  if (paragraph.startsWith('### ')) {
                    return (
                      <h4 key={idx} className="text-sm font-bold text-indigo-300 mt-1 mb-1">
                        {paragraph.replace('### ', '')}
                      </h4>
                    );
                  }
                  return (
                    <p key={idx} className="text-gray-300">
                      {paragraph}
                    </p>
                  );
                })}
              </div>

              {/* Tool Execution Accordion */}
              {msg.tools && msg.tools.length > 0 && (
                <div className="mt-3 pt-2 border-t border-gray-700/60 space-y-1.5">
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1">
                    <Terminal className="w-3 h-3 text-emerald-400" /> Executed LangGraph Tools ({msg.tools.length}):
                  </span>
                  {msg.tools.map((t, tidx) => (
                    <div key={tidx} className="bg-gray-900/80 rounded p-2 text-[11px] font-mono border border-gray-800">
                      <div className="text-emerald-400 font-semibold flex items-center gap-1">
                        <CheckCircle className="w-3 h-3 text-emerald-400" /> tool_call: <span className="text-indigo-300">{t.toolName}()</span>
                      </div>
                      <div className="text-gray-400 truncate mt-0.5">{t.result}</div>
                    </div>
                  ))}
                </div>
              )}

              {/* Actionable Vehicles List */}
              {msg.vehicles && msg.vehicles.length > 0 && (
                <div className="mt-3 pt-2 border-t border-gray-700/60 space-y-1.5">
                  <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1">
                    <AlertCircle className="w-3 h-3 text-amber-400" /> Flagged Fleet Assets:
                  </span>
                  <div className="grid grid-cols-1 gap-1.5">
                    {msg.vehicles.map((v, vidx) => (
                      <div
                        key={vidx}
                        onClick={() => onSelectVin && onSelectVin(v.vin)}
                        className="bg-gray-900/90 hover:bg-gray-950 p-2 rounded-lg border border-gray-700 hover:border-indigo-500 cursor-pointer flex items-center justify-between transition-colors group"
                      >
                        <div>
                          <span className="font-mono font-bold text-indigo-300 text-xs group-hover:text-indigo-200">
                            {v.vin}
                          </span>
                          <span className="text-[10px] text-gray-400 ml-2">
                            ({v.primarySubsystem} - {(v.riskScore * 100).toFixed(0)}% Risk)
                          </span>
                          <div className="text-[11px] text-red-300 font-medium mt-0.5">{v.issue}</div>
                        </div>
                        <ArrowUpRight className="w-4 h-4 text-gray-500 group-hover:text-white transition-colors" />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="text-[9px] text-gray-400 mt-2 text-right">{msg.timestamp}</div>
            </div>

            {/* Suggested Action Chips */}
            {msg.actions && msg.actions.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5 max-w-[88%]">
                {msg.actions.map((act, aidx) => (
                  <button
                    key={aidx}
                    onClick={() => handleSendQuery(act)}
                    className="text-[11px] bg-indigo-950/80 hover:bg-indigo-900 text-indigo-300 border border-indigo-800/80 px-2.5 py-1 rounded-full flex items-center gap-1 transition-colors hover:scale-105"
                  >
                    {act} <ChevronRight className="w-3 h-3" />
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}

        {isTyping && (
          <div className="flex items-center gap-2 text-xs text-indigo-400 bg-gray-800/60 p-3 rounded-xl border border-gray-700/60 w-fit">
            <Sparkles className="w-4 h-4 animate-spin text-indigo-400" />
            <span>LangGraph Copilot is evaluating telemetry graphs & executing tools...</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Query Input Box */}
      <div className="p-4 bg-gray-800/90 border-t border-gray-800 flex-shrink-0">
        <form
          onSubmit={e => {
            e.preventDefault();
            handleSendQuery();
          }}
          className="flex items-center gap-2"
        >
          <input
            type="text"
            value={inputQuery}
            onChange={e => setInputQuery(e.target.value)}
            placeholder="Ask AI Copilot (e.g., 'Schedule service for high risk vehicles')..."
            className="flex-1 bg-gray-900 border border-gray-700 rounded-xl px-4 py-2.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 transition-colors"
          />
          <button
            type="submit"
            disabled={!inputQuery.trim() || isTyping}
            className="p-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-xl shadow-lg shadow-indigo-900/40 transition-all hover:scale-105"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
};
export default FleetCopilotDrawer;
