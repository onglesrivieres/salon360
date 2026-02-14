/**
 * Splits an array of IDs into chunks and runs a query for each chunk,
 * concatenating the results. Avoids URL length limits with large .in() lists.
 */
export async function batchIn<T>(
  queryFn: (ids: string[]) => PromiseLike<{ data: T[] | null; error: any }>,
  ids: string[],
  chunkSize = 50
): Promise<T[]> {
  const results: T[] = [];
  for (let i = 0; i < ids.length; i += chunkSize) {
    const chunk = ids.slice(i, i + chunkSize);
    const { data, error } = await queryFn(chunk);
    if (error) throw error;
    if (data) results.push(...data);
  }
  return results;
}
