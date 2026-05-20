import { makeExecutableSchema } from '@graphql-tools/schema';

import { ucsReadApiTypeDefs } from '@/lib/graphql/schema';
import { ucsGraphqlResolvers } from '@/lib/studio/graphql/resolvers';

export const ucsGraphqlSchema = makeExecutableSchema({
  typeDefs: ucsReadApiTypeDefs,
  resolvers: ucsGraphqlResolvers,
});
