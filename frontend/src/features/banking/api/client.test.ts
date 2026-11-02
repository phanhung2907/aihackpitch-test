import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useAuthStore } from '@/stores/auth-store'
import { login, request, list } from './client'
const session={user:{id:'user-a',login:'alice',role:'customer',customer_id:'customer-a',branch_id:null,enabled:true,version:1},csrf_token:'csrf-from-server',expires_at:'2030-01-01T00:00:00Z'}
function reply(value:unknown,status=200){return new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json'}})}
beforeEach(()=>useAuthStore.getState().auth.reset())
afterEach(()=>vi.unstubAllGlobals())
describe('live banking API boundary',()=>{
 it('logs in with username, same-origin cookie and in-memory CSRF',async()=>{const fetch=vi.fn().mockResolvedValue(reply({data:session}));vi.stubGlobal('fetch',fetch);await login('alice','demo-password');expect(fetch).toHaveBeenCalledWith('/api/v1/auth/login',expect.objectContaining({method:'POST',credentials:'same-origin',body:JSON.stringify({login:'alice',password:'demo-password'})}));expect(useAuthStore.getState().auth.csrfToken).toBe('csrf-from-server');expect(useAuthStore.getState().auth.accessToken).toBe('')})
 it('sends the CSRF and stable idempotency key without interpreting a hold as posted',async()=>{useAuthStore.getState().auth.setCsrfToken('csrf');const fetch=vi.fn().mockResolvedValue(reply({data:{status:'pending_review'}}));vi.stubGlobal('fetch',fetch);const result=await request<{status:string}>('/withdrawals','POST',{account_id:'a',amount:'1000000001'},'same-request-key');expect(result.status).toBe('pending_review');expect(fetch.mock.calls[0][1].headers).toMatchObject({'X-CSRF-Token':'csrf','Idempotency-Key':'same-request-key'})})
 it('follows all cursor pages',async()=>{const fetch=vi.fn().mockResolvedValueOnce(reply({data:[{id:'a'}],meta:{next_cursor:'next&cursor'}})).mockResolvedValueOnce(reply({data:[{id:'b'}],meta:{next_cursor:null}}));vi.stubGlobal('fetch',fetch);expect(await list('/accounts')).toEqual([{id:'a'},{id:'b'}]);expect(fetch.mock.calls[1][0]).toContain('next%26cursor')})
 it('rejects a repeated cursor rather than looping forever',async()=>{vi.stubGlobal('fetch',vi.fn().mockImplementation(()=>Promise.resolve(reply({data:[],meta:{next_cursor:'same'}}))));await expect(list('/accounts')).rejects.toThrow('cursor')})
 it('clears local session display data when server session expires',async()=>{useAuthStore.getState().auth.setUser({accountNo:'a',email:'alice',role:['customer'],exp:1});vi.stubGlobal('fetch',vi.fn().mockResolvedValue(reply({error:{code:'AUTHENTICATION_REQUIRED',message:'Session expired'}},401)));await expect(request('/accounts')).rejects.toThrow('AUTHENTICATION_REQUIRED');expect(useAuthStore.getState().auth.user).toBeNull()})
})

