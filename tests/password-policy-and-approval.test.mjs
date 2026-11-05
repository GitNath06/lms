import test from 'node:test'
import assert from 'node:assert/strict'
import { validatePasswordPolicy } from '../lib/auth-policy.ts'

test('Institutional Password Policy Validator - Comprehensive Invariant Tests', async (t) => {
  await t.test('enforces minimum length of 8 characters', () => {
    const resShort = validatePasswordPolicy('Aa1!bcd')
    assert.strictEqual(resShort.isValid, false)
    assert.strictEqual(resShort.criteria.minLength, false)
    assert.ok(resShort.errors.some((e) => e.includes('8 characters')))

    const resValidLen = validatePasswordPolicy('Aa1!bcde')
    assert.strictEqual(resValidLen.criteria.minLength, true)
  })

  await t.test('enforces uppercase letter requirement', () => {
    const resNoUpper = validatePasswordPolicy('pass1234!')
    assert.strictEqual(resNoUpper.isValid, false)
    assert.strictEqual(resNoUpper.criteria.hasUpper, false)

    const resWithUpper = validatePasswordPolicy('Pass1234!')
    assert.strictEqual(resWithUpper.criteria.hasUpper, true)
  })

  await t.test('enforces lowercase letter requirement', () => {
    const resNoLower = validatePasswordPolicy('PASS1234!')
    assert.strictEqual(resNoLower.isValid, false)
    assert.strictEqual(resNoLower.criteria.hasLower, false)

    const resWithLower = validatePasswordPolicy('PASS1234a!')
    assert.strictEqual(resWithLower.criteria.hasLower, true)
  })

  await t.test('enforces numeric digit requirement', () => {
    const resNoNum = validatePasswordPolicy('Password!')
    assert.strictEqual(resNoNum.isValid, false)
    assert.strictEqual(resNoNum.criteria.hasNumber, false)

    const resWithNum = validatePasswordPolicy('Password1!')
    assert.strictEqual(resWithNum.criteria.hasNumber, true)
  })

  await t.test('enforces special character / symbol requirement', () => {
    const resNoSpecial = validatePasswordPolicy('Password123')
    assert.strictEqual(resNoSpecial.isValid, false)
    assert.strictEqual(resNoSpecial.criteria.hasSpecial, false)

    const resWithSpecial = validatePasswordPolicy('Password123#')
    assert.strictEqual(resWithSpecial.criteria.hasSpecial, true)
    assert.strictEqual(resWithSpecial.isValid, true)
  })

  await t.test('calculates accurate strength scores and ratings', () => {
    const weak = validatePasswordPolicy('abc')
    assert.strictEqual(weak.score <= 1, true)
    assert.strictEqual(weak.strength, 'weak')

    const fair = validatePasswordPolicy('Password')
    assert.strictEqual(fair.score, 3)
    assert.strictEqual(fair.strength, 'fair')

    const good = validatePasswordPolicy('Password12')
    assert.strictEqual(good.score, 4)
    assert.strictEqual(good.strength, 'good')

    const strong = validatePasswordPolicy('G00gle!DeepM!nd#2026')
    assert.strictEqual(strong.score, 5)
    assert.strictEqual(strong.strength, 'strong')
    assert.strictEqual(strong.isValid, true)
  })
})
