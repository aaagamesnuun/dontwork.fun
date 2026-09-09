import {describe,it,expect} from 'vitest';
import {validReleaseUrl} from './ReleaseNotice';
import {RANKING_ORIGIN} from './rankings';
describe('production routing',()=>{
 it('accepts only the configured production host and retained release hosts',()=>{
  expect(validReleaseUrl('https://bebullish.fun/')).toBe(true);
  expect(validReleaseUrl('https://bebullish-v2-3.realnuun.chatgpt.site/')).toBe(true);
  for(const url of ['http://bebullish.fun/','https://bebullish.fun.example/','https://other.bebullish.fun/','https://bebullish.fun@other.example/',null])expect(validReleaseUrl(url)).toBe(false);
 });
 it('keeps the original shared ranking service',()=>{
  expect(RANKING_ORIGIN).toBe('https://bebullish-v1-10-0.realnuun.chatgpt.site');
 });
});
