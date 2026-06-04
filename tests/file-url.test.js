const { fileUrl, uploadedFileParts } = require('../services/file-url');

describe('uploaded file URL helper', () => {
  test('builds authenticated URL from relative upload path', () => {
    expect(fileUrl('uploads/drawings/A-001_R0.pdf'))
      .toBe('/api/files/drawings/A-001_R0.pdf');
  });

  test('builds authenticated URL from Windows absolute upload path', () => {
    expect(fileUrl('C:\\app\\nu-pmc\\uploads\\photos\\site photo.jpg'))
      .toBe('/api/files/photos/site%20photo.jpg');
  });

  test('builds absolute URL when requested', () => {
    expect(fileUrl('uploads/documents/delivery-note.pdf', {
      absolute: true,
      baseUrl: 'https://pmc.example.com/',
    })).toBe('https://pmc.example.com/api/files/documents/delivery-note.pdf');
  });

  test('supports explicit default subdir for legacy basename-only values', () => {
    expect(fileUrl('E-002_R1.pdf', { defaultSubdir: 'drawings' }))
      .toBe('/api/files/drawings/E-002_R1.pdf');
  });

  test('does not make arbitrary non-upload paths routable', () => {
    expect(fileUrl('C:\\tmp\\outside.pdf')).toBeNull();
  });

  test('extracts route parts from upload paths', () => {
    expect(uploadedFileParts('/var/app/uploads/boq/v1.xlsx'))
      .toEqual({ subdir: 'boq', filename: 'v1.xlsx' });
  });
});
