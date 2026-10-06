import { Elysia } from 'elysia'
import { autoHead } from 'elysia/auto-head'
import { IMMUTABLE, shipped } from './app/shipped'
import { site } from './app/site'

export default new Elysia().use(autoHead()).use(shipped(IMMUTABLE)).use(site)
