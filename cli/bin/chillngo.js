#!/usr/bin/env node
import { createInterface } from 'node:readline'

import { run } from '../src/cli.js'

/** Reads a password without echoing it in a terminal, or all of stdin when piped. */
async function promptPassword(question) {
  if (!process.stdin.isTTY) {
    let input = ''
    for await (const chunk of process.stdin) input += chunk
    return input.trim()
  }
  const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true })
  let muted = false
  rl._writeToOutput = (text) => {
    if (!muted) process.stdout.write(text)
  }
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close()
      process.stdout.write('\n')
      resolve(answer)
    })
    muted = true
  })
}

process.exitCode = await run(process.argv.slice(2), {
  stdout: (text) => process.stdout.write(`${text}\n`),
  stderr: (text) => process.stderr.write(`${text}\n`),
  env: process.env,
  promptPassword,
})
