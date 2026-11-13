#!/usr/bin/env node
import('node:path').then(({ dirname, join }) => import(join(dirname(process.argv[1]), 'current', 'ttheme.js')))
