import test from 'node:test';
import assert from 'node:assert/strict';
import { parsePhotoFilename, doNamesMatch, matchPhotosToStudents } from '../lib/student-photos/matcher.ts';

test('Student Photo Filename Parser & Two-Factor Matcher Suite', async (t) => {
  await t.test('1. parsePhotoFilename correctly extracts roll and candidate names', () => {
    const res1 = parsePhotoFilename('8_kaustuv_thapa.jpg');
    assert.equal(res1.extractedRoll, 8);
    assert.equal(res1.extractedNameCandidate, 'kaustuv thapa');
    assert.equal(res1.extension, 'jpg');

    const res2 = parsePhotoFilename('08-kaustuv-thapa.png');
    assert.equal(res2.extractedRoll, 8);
    assert.equal(res2.extractedNameCandidate, 'kaustuv thapa');
    assert.equal(res2.extension, 'png');

    const res3 = parsePhotoFilename('14 aarav sharma.jpeg');
    assert.equal(res3.extractedRoll, 14);
    assert.equal(res3.extractedNameCandidate, 'aarav sharma');

    const res4 = parsePhotoFilename('8.jpg');
    assert.equal(res4.extractedRoll, 8);
    assert.equal(res4.extractedNameCandidate, null);

    const res5 = parsePhotoFilename('kaustuv_thapa.webp');
    assert.equal(res5.extractedRoll, null);
    assert.equal(res5.extractedNameCandidate, 'kaustuv thapa');
  });

  await t.test('2. doNamesMatch identifies normalized token overlaps', () => {
    assert.equal(doNamesMatch('kaustuv thapa', 'Kaustuv Thapa'), true);
    assert.equal(doNamesMatch('kaustuv thapa', 'Kaustav Thapa'), true); // surname match
    assert.equal(doNamesMatch('aarav sharma', 'Bibek Karki'), false);
  });

  await t.test('3. matchPhotosToStudents assigns high confidence on exact roll + name match', () => {
    const mockStudents = [
      { student_id: 's-1', roll_number: 8, full_name: 'Kaustuv Thapa', admission_no: 'ADM-008', registration_no: null },
      { student_id: 's-2', roll_number: 14, full_name: 'Aarav Sharma', admission_no: 'ADM-014', registration_no: null },
      { student_id: 's-3', roll_number: 22, full_name: 'Dipen Gurung', admission_no: '1641052469', registration_no: null },
    ];

    // Mock File object
    const mockFiles = [
      { name: '8_kaustuv_thapa.jpg' },
      { name: '14.jpg' },
      { name: '1641052469.png' },
      { name: '99_unknown_student.jpg' },
    ];

    // Node mock URL.createObjectURL
    globalThis.URL = globalThis.URL || {};
    if (!globalThis.URL.createObjectURL) {
      globalThis.URL.createObjectURL = () => 'blob:mock-url';
    }

    const matches = matchPhotosToStudents(mockFiles, mockStudents);
    assert.equal(matches.length, 4);

    // File 1: 8_kaustuv_thapa.jpg
    assert.equal(matches[0].matchedStudentId, 's-1');
    assert.equal(matches[0].confidence, 'high');
    assert.match(matches[0].matchReason, /Roll 8 \+ Name Verified/);

    // File 2: 14.jpg
    assert.equal(matches[1].matchedStudentId, 's-2');
    assert.equal(matches[1].confidence, 'high');

    // File 3: 1641052469.png (RFID)
    assert.equal(matches[2].matchedStudentId, 's-3');
    assert.equal(matches[2].confidence, 'high');

    // File 4: Unmatched
    assert.equal(matches[3].matchedStudentId, null);
    assert.equal(matches[3].confidence, 'unmatched');
  });
});
