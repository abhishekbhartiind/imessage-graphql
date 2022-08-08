import {
  Conversation,
  ConversationParticipant,
  Message,
  PrismaClient,
} from "@prisma/client";
import { PubSub } from "graphql-subscriptions";
import { Context } from "graphql-ws/lib/server";

/**
 * Server Configuration
 */
export interface Session {
  user?: User;
}

export interface GraphQLContext {
  session: Session | null;
  prisma: PrismaClient;
  pubsub: PubSub;
}

export interface SubscriptionContext extends Context {
  connectionParams: {
    session?: Session;
  };
}

/**
 * Users
 */
export interface User {
  id: string;
  username: string;
}

export interface CreateUsernameResponse {
  success?: boolean;
  error?: string;
}

export interface SearchUsersResponse {
  users: Array<User>;
}

/**
 * Messages
 */
export interface MessageFE extends Message {
  id: string;
  body: string;
  sender: {
    id: string;
    username: string | null;
  };
  createdAt: Date;
}

export interface SendMessageArguments {
  id: string;
  conversationId: string;
  senderId: string;
  body: string;
}

export interface SendMessageSubscriptionPayload {
  messageSent: MessageFE;
}

/**
 * Conversations
 */
export interface ConversationFE extends Conversation {
  participants: Array<ConversationParticipantUser>;
  latestMessage: MessageFE | null;
}

export interface ConversationParticipantUser {
  user: {
    id: string;
    username: string | null;
  };
}

export interface NewConveration extends Conversation {
  participants: Array<ConversationParticipantUser>;
}

export interface CreateConversationSubscriptionPayload {
  conversationCreated: NewConveration;
}

export interface ConversationUpdatedSubscriptionData {
  conversationUpdated: ConversationFE;
}

export interface DeleteConversationSubscriptionPayload {
  conversationDeleted: Conversation & {
    participants: Array<ConversationParticipant>;
  };
}
