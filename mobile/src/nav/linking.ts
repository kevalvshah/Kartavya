import type { LinkingOptions } from '@react-navigation/native';
import type { RootStackParamList } from './RootStack';

export const linking: LinkingOptions<RootStackParamList> = {
  prefixes: ['kartavya://', 'https://app.kartavya.in'],
  config: {
    screens: {
      Main: {
        screens: {
          Today:  'today',
          Boards: 'boards',
          Inbox:  'inbox',
          Me:     'me',
        },
      },
      TaskDetail: 'task/:taskId',
      Board:      'board/:projectId',
      Settings:   'settings',
    },
  },
};
