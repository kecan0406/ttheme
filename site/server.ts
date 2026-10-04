import { Elysia } from 'elysia'
import { shipped } from './app/shipped'
import { site } from './app/site'

export default new Elysia().use(shipped).use(site)
