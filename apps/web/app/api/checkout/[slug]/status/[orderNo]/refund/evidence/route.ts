// Buyer attaches evidence to an OPEN refund (REFUND-1b). multipart/form-data:
// `file` (the upload) + `evidenceType`. Authorized by possession of the public
// (slug, order_no) pair — same discipline as filing the refund. The file goes
// to a PRIVATE bucket via the service-role backend; MIME + size are validated
// server-side. One generic 404 for missing order / no open refund.
import { addRefundEvidence, PaymentError } from "@trustip/payments";
import {
  checkoutSlugSchema,
  orderNoSchema,
  refundEvidenceTypeSchema,
} from "@trustip/validators";
import { NextResponse } from "next/server";
import { enforceRateLimit, errorResponse } from "../../../../../../_lib/payments";
import { getRefundDeps } from "../../../../../../_lib/refund";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Hard ceiling before we buffer the body (the service + bucket re-check).
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

export async function POST(
  request: Request,
  context: { params: Promise<{ slug: string; orderNo: string }> },
): Promise<NextResponse> {
  const limited = enforceRateLimit(request, "refund-evidence");
  if (limited) return limited;
  try {
    const raw = await context.params;
    const slug = checkoutSlugSchema.safeParse(raw.slug);
    const orderNo = orderNoSchema.safeParse(raw.orderNo);
    if (!slug.success || !orderNo.success) {
      throw new PaymentError("CheckoutNotFound", "order not found");
    }

    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      throw new PaymentError("InvalidInput", "file is required");
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      throw new PaymentError("InvalidInput", "file exceeds the size limit");
    }
    const evidenceType = refundEvidenceTypeSchema.safeParse(
      form.get("evidenceType") ?? "other",
    );
    if (!evidenceType.success) {
      throw new PaymentError("InvalidInput", "invalid evidence type");
    }

    const bytes = new Uint8Array(await file.arrayBuffer());
    const result = await addRefundEvidence(getRefundDeps(), {
      slug: slug.data,
      orderNo: orderNo.data,
      evidenceType: evidenceType.data,
      file: { bytes, mimeType: file.type, fileName: file.name },
    });
    return NextResponse.json(result);
  } catch (e) {
    return errorResponse(e);
  }
}
