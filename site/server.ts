import { Elysia } from 'elysia'
import { autoHead } from 'elysia/auto-head'
import { site } from './app/site'

export default new Elysia().use(autoHead()).use(site)
