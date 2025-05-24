import { whop } from "./ApolloGraphQLClient";
import { gql } from "@apollo/client";
import {
  SendMessageInput,
  ChatFeed,
  FeedPostsResponse,
  ProcessEntitiesInput,
  FeedTypes,
  CreateDmChannelInput,
  DmsChannelsResponse,
  ChatFeedInput,
} from "./graphql/types";

export const SEND_MESSAGE_MUTATION = gql`
  mutation SendMessage($input: SendMessageInput!) {
    sendMessage(input: $input)
  }
`;

const PROCESS_ENTITIES_MUTATION = gql`
  mutation MessagesProcessEntitiesMutation($input: ProcessEntitiesInput!) {
    processEntities(input: $input) {
      entities {
        createdAt
        entityType
        id
        isDeleted
        sortKey
        syncError {
          message
        }
        updatedAt
      }
    }
  }
`;

const GET_CHAT_FEED = gql`
  query GetChatFeedDetails($feedId: ID!) {
    chatFeed(feedId: $feedId) {
      id
      experienceId
      createdAt
      updatedAt
    }
  }
`;

export const LIST_CHAT_FEEDS_QUERY = gql`
  query ListChatFeeds {
    chatFeeds {
      id
      title
      description
      createdAt
      updatedAt
      isPrivate
      userCount
    }
  }
`;

const LIST_DM_CHANNELS_QUERY = gql`
  query ListDmChannels {
    dmsChannels {
      nodes {
        id
        title
        createdAt
        updatedAt
        participants {
          id
          username
          name
          profilePic
        }
      }
    }
  }
`;

const CREATE_CHAT_FEED_MUTATION = gql`
  mutation CreateChatFeed($input: ChatFeedInput!) {
    createChatFeed(input: $input) {
      id
      title
      description
      experienceId
    }
  }
`;

export const GET_FEED_POSTS_QUERY = gql`
  query FeedPosts(
    $feedId: ID!
    $feedType: FeedTypes!
    $limit: Int
    $direction: Direction
  ) {
    feedPosts(
      feedId: $feedId
      feedType: $feedType
      limit: $limit
      direction: $direction
      includeDeleted: false
      includeReactions: false
    ) {
      posts {
        ... on DmsPost {
          id
          userId
          content
          createdAt
          feedId
          feedType
          isPosterAdmin
          mentionedUserIds
        }
      }
      users {
        id
        username
        name
        profilePic
      }
    }
  }
`;

const CREATE_DM_CHANNEL_MUTATION = gql`
  mutation CreateDmChannel($input: CreateDmChannelInput!) {
    createDmChannel(input: $input) {
      feedData {
        feed {
          id
        }
      }
    }
  }
`;

export interface UpdateMessageInput {
  postId: string;
  message: string;
  embed?: any;
}

export async function sendMessage(input: SendMessageInput): Promise<string> {
  const data = await whop.callGraphQL<{ sendMessage: string }>(
    SEND_MESSAGE_MUTATION,
    { input }
  );
  return data.sendMessage;
}


/**
 * Get the experienceId for a chat feed
 * @param feedId The ID of the feed
 * @returns The experienceId of the feed
 */
export async function getChatFeedExperienceId(
  feedId: string
): Promise<string | null> {
  try {
    const data = await whop.callGraphQL<{ chatFeed: { experienceId: string } }>(
      GET_CHAT_FEED,
      { feedId }
    );

    return data.chatFeed.experienceId || null;
  } catch (error) {
    console.error("Error getting chat feed details:", error);
    return null;
  }
}

/**
 * List all available chat feeds
 * @returns Array of chat feed objects
 */
export async function listChatFeeds(): Promise<ChatFeed[]> {
  const data = await whop.callGraphQL<{ chatFeeds: ChatFeed[] }>(
    LIST_CHAT_FEEDS_QUERY,
    {}
  );
  return data.chatFeeds;
}

/**
 * List all DM channels for the current user
 * @returns DM channels response with participant info
 */
export async function listDmChannels(): Promise<DmsChannelsResponse> {
  const data = await whop.callGraphQL<{ dmsChannels: DmsChannelsResponse }>(
    LIST_DM_CHANNELS_QUERY,
    {}
  );
  return data.dmsChannels;
}

/**
 * Create a new chat feed
 * @param input The chat feed creation input
 * @returns The created chat feed details
 */
export async function createChatFeed(input: ChatFeedInput): Promise<{
  id: string;
  title?: string;
  description?: string;
  experienceId?: string;
}> {
  const data = await whop.callGraphQL<{
    createChatFeed: {
      id: string;
      title?: string;
      description?: string;
      experienceId?: string;
    };
  }>(CREATE_CHAT_FEED_MUTATION, { input });

  return data.createChatFeed;
}

/**
 * Get recent posts from a feed
 * @param feedId The ID of the feed to get posts from
 * @param feedType The type of feed (chat_feed, livestream_feed, etc.)
 * @param limit The maximum number of posts to fetch
 * @param direction The sort direction ("asc" or "desc")
 * @returns Feed posts response with posts, users, and reactions
 */
export async function getFeedPosts(
  feedId: string,
  feedType: string,
  limit: number = 50,
  direction: string = "desc"
): Promise<FeedPostsResponse> {
  const data = await whop.callGraphQL<{ feedPosts: FeedPostsResponse }>(
    GET_FEED_POSTS_QUERY,
    {
      feedId,
      feedType,
      limit,
      direction,
    }
  );

  return data.feedPosts;
}

/**
 * Create a DM channel between the bot and the user
 * @param userId The ID of the user to create a DM with
 * @returns The ID of the created DM feed
 */
export async function createDmChannel(userId: string): Promise<string> {
  const input: CreateDmChannelInput = {
    withUserIds: [userId],
  };

  const data = await whop.callGraphQL<{
    createDmChannel: {
      feedData: {
        feed: {
          id: string;
        };
      };
    };
  }>(CREATE_DM_CHANNEL_MUTATION, { input });

  return data.createDmChannel.feedData.feed.id;
}


/**
 * Delete multiple messages from a feed
 * @param messageIds Array of message IDs to delete
 * @param feedId The ID of the feed containing the messages
 * @param feedType The type of feed (must be a valid FeedTypes enum value)
 * @param appId The ID of the app
 * @returns Promise that resolves when deletion is complete
 */
export async function purgeMessages(
  messageIds: string[],
  feedId: string,
  feedType: FeedTypes,
  appId: string
): Promise<void> {
  if (!messageIds.length) {
    return;
  }

  const input: ProcessEntitiesInput = {
    appId,
    dmsPosts: messageIds.map((id) => ({
      id,
      feedId,
      feedType,
      isDeleted: true,
      content: "",
      mentionedUserIds: [],
      isEveryoneMentioned: false,
    })),
  };

  await whop.callGraphQL(PROCESS_ENTITIES_MUTATION, { input });
}
