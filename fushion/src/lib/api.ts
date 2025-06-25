// Allow overriding the backend URL via Vite environment variable.
// Fallback to the current origin so the frontend works when
// served by the backend in production.
const API_BASE =
  (typeof import.meta !== 'undefined' &&
    (import.meta as any).env?.VITE_API_BASE) ||
  (typeof process !== 'undefined' && (process as any).env?.NEXT_PUBLIC_API) ||
  'http://localhost:8000';

export interface LoginRequest {
  user: string;
  key: string;
}

export interface Thread {
  id: string;
  title: string;
}

export interface Message {
  role: 'user' | 'assistant';
  content: string;
  image?: string;
}

export interface ChatRequest {
  thread_id: string;
  question: string;
  image?: string;
}

class ApiClient {
  private token: string | null = null;
  public API_BASE = API_BASE;

  constructor() {
    this.token = localStorage.getItem('auth_token');
  }

  getHeaders() {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }
    return headers;
  }

  async login(credentials: LoginRequest) {
    const response = await fetch(`${API_BASE}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(credentials),
    });
    
    if (!response.ok) {
      throw new Error('Login failed');
    }
    
    const data = await response.json();
    this.token = data.token;
    localStorage.setItem('auth_token', this.token!);
    return data;
  }

  logout() {
    this.token = null;
    localStorage.removeItem('auth_token');
  }

  getUserId(): string | null {
    if (!this.token) return null;
    try {
      // JWT-like token에서 사용자 ID 추출 (점 앞부분)
      return this.token.split('.')[0];
    } catch {
      return null;
    }
  }

  async createThread(): Promise<Thread> {
    const response = await fetch(`${API_BASE}/threads`, {
      method: 'POST',
      headers: this.getHeaders(),
    });
    
    if (!response.ok) {
      throw new Error('Failed to create thread');
    }
    
    const data = await response.json();
    return { id: data.thread_id, title: data.title };
  }

  async getThreads(): Promise<Thread[]> {
    const response = await fetch(`${API_BASE}/threads`, {
      headers: this.getHeaders(),
    });
    
    if (!response.ok) {
      throw new Error('Failed to fetch threads');
    }
    
    return response.json();
  }

  async deleteThread(threadId: string) {
    const response = await fetch(`${API_BASE}/threads/${threadId}`, {
      method: 'DELETE',
      headers: this.getHeaders(),
    });
    
    if (!response.ok) {
      throw new Error('Failed to delete thread');
    }
    
    return response.json();
  }

  async getMessages(threadId: string): Promise<Message[]> {
    const response = await fetch(`${API_BASE}/messages/${threadId}`, {
      headers: this.getHeaders(),
    });
    
    if (!response.ok) {
      throw new Error('Failed to fetch messages');
    }
    
    return response.json();
  }

  async sendMessage(request: ChatRequest): Promise<Message> {
    const response = await fetch(`${API_BASE}/chat`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(request),
    });
    
    if (!response.ok) {
      throw new Error('Failed to send message');
    }
    
    return response.json();
  }

  createStreamEventSource(request: ChatRequest): EventSource {
    const url = new URL(`${API_BASE}/chat/stream`);
    const headers = this.getHeaders();
    
    // EventSource는 GET만 지원하므로 POST 데이터를 직접 전송할 수 없습니다.
    // 대신 fetch로 스트림을 처리합니다.
    throw new Error('Use sendMessageStream instead');
  }

  async sendMessageStream(request: ChatRequest): Promise<ReadableStream<Uint8Array>> {
    const response = await fetch(`${API_BASE}/chat/stream`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(request),
    });
    
    if (!response.ok) {
      throw new Error('Failed to send message');
    }
    
    return response.body!;
  }

  async renameThread(threadId: string, title: string) {
    const response = await fetch(`${API_BASE}/threads/${threadId}`, {
      method: 'PATCH',
      headers: this.getHeaders(),
      body: JSON.stringify({ title }),
    });
    
    if (!response.ok) {
      throw new Error('Failed to rename thread');
    }
    
    return response.json();
  }

  isAuthenticated(): boolean {
    return !!this.token;
  }
}

export const apiClient = new ApiClient();
