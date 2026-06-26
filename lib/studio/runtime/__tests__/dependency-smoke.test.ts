import { execFileSync } from 'node:child_process'

import nodemailer from 'nodemailer'

describe('upgraded runtime dependencies', () => {
  it('sends a no-network email with Nodemailer stream transport', async () => {
    const transport = nodemailer.createTransport({
      streamTransport: true,
      buffer: true,
      newline: 'unix',
    })

    const info = await transport.sendMail({
      from: 'from@example.com',
      to: 'to@example.com',
      subject: 'Dependency smoke',
      text: 'Nodemailer stream transport smoke test',
    })

    expect(info.messageId).toBeTruthy()
    expect(Buffer.isBuffer(info.message)).toBe(true)
  })

  it('creates a non-empty PDF with jsPDF', async () => {
    const jspdfModule = await import('jspdf')
    const JsPDF = ((jspdfModule as any).default ?? (jspdfModule as any).jsPDF) as any

    const pdf = new JsPDF({ unit: 'pt', format: 'letter' })
    pdf.text('Dependency smoke', 20, 20)

    const bytes = pdf.output('arraybuffer') as ArrayBuffer
    expect(bytes.byteLength).toBeGreaterThan(100)
  })

  it('generates and validates UUID v4 values', async () => {
    const { v4, validate, version } = await import('uuid')

    const id = v4()

    expect(validate(id)).toBe(true)
    expect(version(id)).toBe(4)
  })

  it('loads package entrypoints used by production integrations', async () => {
    const script = `
      const [
        awsS3,
        awsPresigner,
        awsLibStorage,
        vercelBlob,
        vercelSandbox,
        workflow,
        workflowApi,
        workflowNext
      ] = await Promise.all([
        import('@aws-sdk/client-s3'),
        import('@aws-sdk/s3-request-presigner'),
        import('@aws-sdk/lib-storage'),
        import('@vercel/blob'),
        import('@vercel/sandbox'),
        import('workflow'),
        import('workflow/api'),
        import('workflow/next')
      ]);

      const assertions = [
        ['awsS3.S3Client', typeof awsS3.S3Client === 'function'],
        ['awsS3.PutObjectCommand', typeof awsS3.PutObjectCommand === 'function'],
        ['awsPresigner.getSignedUrl', typeof awsPresigner.getSignedUrl === 'function'],
        ['awsLibStorage.Upload', typeof awsLibStorage.Upload === 'function'],
        ['vercelBlob.put', typeof vercelBlob.put === 'function'],
        ['vercelSandbox.Sandbox', Boolean(vercelSandbox.Sandbox)],
        ['workflow.sleep', typeof workflow.sleep === 'function'],
        ['workflow.FatalError', typeof workflow.FatalError === 'function'],
        ['workflowApi.start', typeof workflowApi.start === 'function'],
        ['workflowNext.withWorkflow', typeof workflowNext.withWorkflow === 'function']
      ];

      for (const [name, passed] of assertions) {
        if (!passed) {
          throw new Error(name + ' did not load with the expected shape');
        }
      }
    `

    expect(() =>
      execFileSync(process.execPath, ['--input-type=module', '--eval', script], {
        cwd: process.cwd(),
        env: {
          ...process.env,
          STUDIO_DISABLE_WORKFLOW_PLUGIN: 'true',
        },
        stdio: 'pipe',
      }),
    ).not.toThrow()
  })
})
