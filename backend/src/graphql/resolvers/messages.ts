import { ApolloError } from "apollo-server-core";
import { withFilter } from "graphql-subscriptions";
import {
  GraphQLContext,
  MessageFE,
  SendMessageArguments,
  SendMessageSubscriptionPayload,
} from "../../util/types";

const resolvers = {
  Query: {
    messages: async function (
      _: any,
      args: { conversationId: string },
      context: GraphQLContext
    ): Promise<Array<MessageFE>> {
      const { session, prisma } = context;
      const { conversationId } = args;

      if (!session?.user) {
        throw new ApolloError("Not authorized");
      }

      try {
        const messages = await prisma.message.findMany({
          where: {
            conversationId,
          },
          include: {
            sender: {
              select: {
                id: true,
                username: true,
              },
            },
          },
          orderBy: {
            createdAt: "desc",
          },
        });

        return messages;
      } catch (error: any) {
        console.log("messages error", error);
        throw new ApolloError(error?.message);
      }
    },
  },
  Mutation: {
    sendMessage: async function (
      _: any,
      args: SendMessageArguments,
      context: GraphQLContext
    ): Promise<boolean> {
      const { session, prisma, pubsub } = context;

      if (!session?.user) {
        throw new ApolloError("Not authorized");
      }

      const { id: userId } = session.user;

      /**
       * @todo
       * Consider adding participantId to args
       */
      const { id: messageId, senderId, conversationId, body } = args;

      try {
        /**
         * Create new message entity
         */
        const newMessage = await prisma.message.create({
          data: {
            id: messageId,
            senderId,
            conversationId,
            body,
          },
          include: {
            sender: {
              select: {
                id: true,
                username: true,
              },
            },
          },
        });

        // /**
        //  * @todo
        //  * Consider passing participantId in args
        //  */
        const participant = await prisma.conversationParticipants.findFirst({
          where: {
            userId,
          },
        });

        /**
         * Should always exist
         * @todo
         * Consider passing participantId in args
         */
        if (!participant) {
          throw new ApolloError("Participant does not exist");
        }

        const { id: participantId } = participant;

        /**
         * Update conversation latestMessage
         */
        const conversation = await prisma.conversation.update({
          where: {
            id: conversationId,
          },
          data: {
            latestMessageId: newMessage.id,
            participants: {
              update: {
                where: {
                  id: participantId,
                },
                data: {
                  hasSeenLatestMessage: true,
                },
              },
              updateMany: {
                where: {
                  NOT: {
                    userId,
                  },
                },
                data: {
                  hasSeenLatestMessage: false,
                },
              },
            },
          },
          include: {
            participants: {
              include: {
                user: {
                  select: {
                    id: true,
                    username: true,
                  },
                },
              },
            },
            latestMessage: true,
          },
        });

        pubsub.publish("MESSAGE_SENT", { messageSent: newMessage });
        pubsub.publish("CONVERSATION_UPDATED", {
          conversationUpdated: conversation,
        });

        return true;
      } catch (error) {
        console.log("sendMessage error", error);
        throw new ApolloError("Error sending message");
      }
    },
  },
  Subscription: {
    messageSent: {
      subscribe: withFilter(
        (_: any, __: any, context: GraphQLContext) => {
          const { pubsub } = context;

          return pubsub.asyncIterator(["MESSAGE_SENT"]);
        },
        (
          payload: SendMessageSubscriptionPayload,
          args: { conversationId: string },
          context: GraphQLContext
        ) => {
          return payload.messageSent.conversationId === args.conversationId;
        }
      ),
    },
  },
};

export default resolvers;
