import { createEmbed, createField, createMessage, type Message } from './embed'

export interface Template {
  id: string
  name: string
  build: () => Message
}

export function starterMessage(): Message {
  return createMessage({
    username: 'Embed Editor',
    embeds: [
      createEmbed({
        color: 0x00a8fc,
        author: { name: 'Server updates', url: '', iconUrl: '' },
        title: 'Welcome to the editor',
        description:
          'Drag blocks from the left onto this embed, or click any part to edit it in place.\n\nEverything supports **Discord markdown**, like `code`, ||spoilers|| and [links](https://discord.com).',
        fields: [
          createField({ name: 'Drag', value: 'Reorder fields by dragging them', inline: true }),
          createField({ name: 'Edit', value: 'Click any text to change it', inline: true }),
          createField({ name: 'Export', value: 'JSON, prompt or code', inline: true }),
        ],
        footer: { text: 'Discord Embed Editor', iconUrl: '' },
        timestamp: new Date().toISOString(),
      }),
    ],
  })
}

export const TEMPLATES: Template[] = [
  { id: 'starter', name: 'Getting started', build: starterMessage },
  {
    id: 'announcement',
    name: 'Announcement',
    build: () =>
      createMessage({
        content: '@everyone',
        embeds: [
          createEmbed({
            color: 0xfee75c,
            title: 'Server maintenance this Saturday',
            description:
              'The server will be offline for about **two hours** while we move to new hardware.\n\nYour progress is saved and nothing needs to be done on your side.',
            fields: [
              createField({ name: 'Starts', value: '<t:1767225600:F>', inline: true }),
              createField({ name: 'Duration', value: 'About 2 hours', inline: true }),
            ],
            footer: { text: 'Questions go in #support', iconUrl: '' },
          }),
        ],
      }),
  },
  {
    id: 'welcome',
    name: 'Welcome',
    build: () =>
      createMessage({
        embeds: [
          createEmbed({
            color: 0x57f287,
            title: 'Welcome aboard',
            description:
              'Glad to have you here. Start with these three channels:\n\n- <#100000000000000001> to read the rules\n- <#100000000000000002> to pick your roles\n- <#100000000000000003> to say hello',
            footer: { text: 'You can change your roles at any time', iconUrl: '' },
          }),
        ],
      }),
  },
  {
    id: 'rules',
    name: 'Rules',
    build: () =>
      createMessage({
        embeds: [
          createEmbed({
            color: 0xed4245,
            title: 'Server rules',
            description: 'Breaking a rule can get you muted or removed.',
            fields: [
              createField({ name: '1. Be respectful', value: 'No harassment, slurs or personal attacks.' }),
              createField({ name: '2. No spam', value: 'Keep self promotion to the channel made for it.' }),
              createField({ name: '3. Stay on topic', value: 'Use the channel that fits what you are posting.' }),
              createField({ name: '4. Follow Discord terms', value: '[Terms of Service](https://discord.com/terms)' }),
            ],
          }),
        ],
      }),
  },
  {
    id: 'changelog',
    name: 'Changelog',
    build: () =>
      createMessage({
        embeds: [
          createEmbed({
            color: 0x5865f2,
            author: { name: 'Release notes', url: '', iconUrl: '' },
            title: 'Version 2.4.0',
            description:
              '### Added\n- Dark mode for the dashboard\n- Export to CSV\n### Fixed\n- Login loop on Safari\n- Timezone shown in UTC instead of local time',
            footer: { text: 'Full notes on GitHub', iconUrl: '' },
            timestamp: new Date().toISOString(),
          }),
        ],
      }),
  },
  {
    id: 'event',
    name: 'Event',
    build: () =>
      createMessage({
        embeds: [
          createEmbed({
            color: 0xeb459e,
            title: 'Community game night',
            description: 'Bring a friend. Voice chat is optional.',
            fields: [
              createField({ name: 'When', value: '<t:1767999600:F>\n<t:1767999600:R>', inline: true }),
              createField({ name: 'Where', value: '<#100000000000000004>', inline: true }),
              createField({ name: 'Game', value: 'Decided by vote', inline: true }),
            ],
          }),
        ],
      }),
  },
  { id: 'blank', name: 'Blank', build: () => createMessage() },
]
