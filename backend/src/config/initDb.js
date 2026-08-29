import pool from './db.js';

const createTablesQuery = `
  CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

  CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      name VARCHAR(100),
      username VARCHAR(20) UNIQUE,
      email VARCHAR(255) UNIQUE NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      recver INT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS documents (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      user_id UUID REFERENCES users(id) ON DELETE CASCADE,
      guest_id UUID,
      file_name VARCHAR(255) NOT NULL,
      file_path TEXT NOT NULL,
      file_size_bytes BIGINT NOT NULL,
      mime_type VARCHAR(100) DEFAULT 'application/pdf',
      status VARCHAR(50) DEFAULT 'processing',
      pinecone_namespace VARCHAR(255),
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT chk_ownership CHECK (user_id IS NOT NULL OR guest_id IS NOT NULL)
  );

  CREATE TABLE IF NOT EXISTS chat_sessions (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      user_id UUID REFERENCES users(id) ON DELETE CASCADE,
      guest_id UUID,
      document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
      title VARCHAR(255) DEFAULT 'New Conversation',
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT chk_chat_ownership CHECK (user_id IS NOT NULL OR guest_id IS NOT NULL)
  );

  CREATE TABLE IF NOT EXISTS messages (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      session_id UUID NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
      role VARCHAR(20) NOT NULL,
      content TEXT NOT NULL,
      metadata JSONB DEFAULT '{}',
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
  );

  CREATE INDEX IF NOT EXISTS idx_docs_user_id ON documents(user_id);
  CREATE INDEX IF NOT EXISTS idx_docs_guest_id ON documents(guest_id);
  CREATE INDEX IF NOT EXISTS idx_chats_user_id ON chat_sessions(user_id);
  CREATE INDEX IF NOT EXISTS idx_chats_guest_id ON chat_sessions(guest_id);
  CREATE INDEX IF NOT EXISTS idx_messages_session_id ON messages(session_id);
`;

export const initializeDatabase = async () => {
  try {
    console.log('Running database table migrations...');
    await pool.query(createTablesQuery);
    console.log('All database tables and indexes initialized successfully.');
  } catch (error) {
    console.error('Failed to initialize database tables:', error.message);
    throw error;
  }
};