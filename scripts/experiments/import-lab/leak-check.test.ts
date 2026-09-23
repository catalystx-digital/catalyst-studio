/** @jest-environment node */
import { scanAddedLines, hostnameParts } from './leak-check'

test('finds whole-word site parts in added diff lines',()=>{
  const parts=hostnameParts(['invented-test.example'])
  const diff='diff --git a/fixture.txt b/fixture.txt\n+++ b/fixture.txt\n@@ -0,0 +1 @@\n+The test section changed\n'
  expect(scanAddedLines(diff,parts)).toEqual([{file:'fixture.txt',line:1,part:'test'}])
})
test('clean diff passes and embedded words do not trigger',()=>{
  const parts=hostnameParts(['invented-test.example'])
  expect(scanAddedLines('diff --git a/fixture.txt b/fixture.txt\n+++ b/fixture.txt\n@@ -0,0 +1 @@\n+The fastest section changed\n',parts)).toEqual([])
  expect(scanAddedLines('',parts)).toEqual([])
})
test('scans added lines beginning with two plus signs and keeps later line numbers',()=>{
  const parts=hostnameParts(['invented.example'])
  const diff='diff --git a/fixture.txt b/fixture.txt\n--- a/fixture.txt\n+++ b/fixture.txt\n@@ -0,0 +1,3 @@\n+++invented;\n+ordinary\n+invented again\n'
  expect(scanAddedLines(diff,parts)).toEqual([
    {file:'fixture.txt',line:1,part:'invented'},
    {file:'fixture.txt',line:3,part:'invented'}
  ])
})
