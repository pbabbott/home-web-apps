import { matchesNamePattern } from '../../src/lib/name-pattern';

describe('matchesNamePattern', () => {
  it('matches by extension, ignoring case', () => {
    expect(matchesNamePattern('*.exe', 'Setup.EXE')).toBe(true);
    expect(matchesNamePattern('*.exe', 'setup.exe.txt')).toBe(false);
  });

  it('matches ? as exactly one character', () => {
    expect(matchesNamePattern('photo (?).jpg', 'photo (1).jpg')).toBe(true);
    expect(matchesNamePattern('photo (?).jpg', 'photo (12).jpg')).toBe(false);
  });

  it('treats regex characters literally', () => {
    expect(matchesNamePattern('a+b*.txt', 'a+bc.txt')).toBe(true);
    expect(matchesNamePattern('a+b*.txt', 'aab.txt')).toBe(false);
  });

  it('does not match a longer extension (*.htm vs .html)', () => {
    expect(matchesNamePattern('*.htm', 'index.html')).toBe(false);
  });
});
