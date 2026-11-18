import { describe, it, expect } from 'vitest'
import { createEmbed, createField, createMessage } from '../model/embed'
import { jsString, pyString, toCurl, toDiscordJs, toDiscordPy } from './code'

const message = createMessage({
  content: "It's live",
  embeds: [
    createEmbed({
      color: 0x5865f2,
      author: { name: 'Team', url: 'https://example.com', iconUrl: '' },
      title: 'Release',
      url: 'https://example.com/r',
      description: 'Line one\nUse `npm i` and ${HOME}',
      fields: [createField({ name: 'Version', value: '1.0', inline: true }), createField({ name: 'Notes', value: 'None' })],
      footer: { text: 'Footer', iconUrl: 'https://example.com/f.png' },
      timestamp: '2024-05-01T12:00:00.000Z',
    }),
  ],
})

describe('string escaping', () => {
  it('escapes javascript strings', () => {
    expect(jsString("it's")).toBe("'it\\'s'")
    expect(jsString('back\\slash')).toBe("'back\\\\slash'")
    expect(jsString('a\nb `c` ${d}')).toBe('`a\nb \\`c\\` \\${d}`')
    expect(jsString('$ {x} $x')).toBe("'$ {x} $x'")
  })

  it('escapes python strings', () => {
    expect(pyString('say "hi"')).toBe('"say \\"hi\\""')
    expect(pyString('a\nb"')).toBe('"""a\nb\\""""')
    expect(pyString('c:\\path')).toBe('"c:\\\\path"')
  })
})

describe('toDiscordJs', () => {
  it('builds an EmbedBuilder chain', () => {
    const code = toDiscordJs(message)
    expect(code).toContain("import { EmbedBuilder } from 'discord.js'")
    expect(code).toContain('const embed = new EmbedBuilder()')
    expect(code).toContain('.setColor(0x5865F2)')
    expect(code).toContain(".setAuthor({ name: 'Team', url: 'https://example.com' })")
    expect(code).toContain(".setTitle('Release')")
    expect(code).toContain(".setURL('https://example.com/r')")
    expect(code).toContain('.setDescription(`Line one\nUse \\`npm i\\` and \\${HOME}`)')
    expect(code).toContain("{ name: 'Version', value: '1.0', inline: true },")
    expect(code).toContain("{ name: 'Notes', value: 'None' },")
    expect(code).toContain(".setFooter({ text: 'Footer', iconURL: 'https://example.com/f.png' })")
    expect(code).toContain(".setTimestamp(new Date('2024-05-01T12:00:00.000Z'))")
    expect(code).toContain("await channel.send({ content: 'It\\'s live', embeds: [embed] })")
    expect(code).not.toContain('setImage')
  })

  it('names multiple embeds and skips empty ones', () => {
    const m = createMessage({ embeds: [createEmbed({ title: 'A' }), createEmbed(), createEmbed({ title: 'B' })] })
    const code = toDiscordJs(m)
    expect(code).toContain('const embed1 = new EmbedBuilder()')
    expect(code).toContain('const embed2 = new EmbedBuilder()')
    expect(code).not.toContain('embed3')
    expect(code).toContain('await channel.send({ embeds: [embed1, embed2] })')
  })
})

describe('toDiscordPy', () => {
  it('builds a discord.Embed', () => {
    const code = toDiscordPy(message)
    expect(code.startsWith('import discord\nimport datetime\n')).toBe(true)
    expect(code).toContain('    title="Release",')
    expect(code).toContain('    url="https://example.com/r",')
    expect(code).toContain('    description="""Line one\nUse `npm i` and ${HOME}""",')
    expect(code).toContain('    color=0x5865F2,')
    expect(code).toContain('timestamp=datetime.datetime.fromisoformat("2024-05-01T12:00:00.000+00:00")')
    expect(code).toContain('embed.set_author(name="Team", url="https://example.com")')
    expect(code).toContain('embed.add_field(name="Version", value="1.0", inline=True)')
    expect(code).toContain('embed.add_field(name="Notes", value="None", inline=False)')
    expect(code).toContain('embed.set_footer(text="Footer", icon_url="https://example.com/f.png")')
    expect(code).toContain('await channel.send(content="It\'s live", embeds=[embed])')
  })

  it('omits datetime when there is no timestamp', () => {
    const code = toDiscordPy(createMessage({ embeds: [createEmbed({ image: 'https://e.com/i.png' })] }))
    expect(code).not.toContain('datetime')
    expect(code).toContain('embed = discord.Embed()')
    expect(code).toContain('embed.set_image(url="https://e.com/i.png")')
  })
})

describe('toCurl', () => {
  it('posts compact JSON with escaped single quotes', () => {
    const code = toCurl(message)
    const lines = code.trimEnd().split('\n')
    expect(lines[0]).toBe('WEBHOOK_URL="https://discord.com/api/webhooks/your/webhook"')
    expect(lines[2]).toBe('curl -X POST "$WEBHOOK_URL" \\')
    expect(lines[3]).toBe('  -H "Content-Type: application/json" \\')
    expect(lines[4]!.startsWith(`  -d '{"content":"It'\\''s live"`)).toBe(true)
    expect(lines).toHaveLength(5)
  })
})
