import { db } from './firebase-admin';

/**
 * Fetch latest progress timestamps for multiple tasks.
 * Returns a map of taskId -> latest progress createdAt (in ms)
 */
export async function getLatestProgressForTasks(taskIds: string[]): Promise<Map<string, number>> {
  const progressMap = new Map<string, number>();
  
  if (taskIds.length === 0) return progressMap;
  
  // Firestore 'in' supports up to 30 items
  const batchSize = 30;
  
  for (let i = 0; i < taskIds.length; i += batchSize) {
    const batch = taskIds.slice(i, i + batchSize);
    
    // Query progresses for this batch of tasks
    const snapshot = await db
      .collection('progresses')
      .where('taskId', 'in', batch)
      .orderBy('createdAt', 'desc')
      .get();
    
    // For each task, keep only the latest progress
    snapshot.docs.forEach((doc) => {
      const data = doc.data();
      const taskId = data.taskId;
      const createdAt = data.createdAt; // Already in ms
      
      if (!progressMap.has(taskId) || createdAt > progressMap.get(taskId)!) {
        progressMap.set(taskId, createdAt);
      }
    });
  }
  
  return progressMap;
}

/**
 * Fetch latest progress timestamp for a single task.
 * Returns the createdAt timestamp in ms, or null if no progress exists.
 */
export async function getLatestProgressForTask(taskId: string): Promise<number | null> {
  const snapshot = await db
    .collection('progresses')
    .where('taskId', '==', taskId)
    .orderBy('createdAt', 'desc')
    .limit(1)
    .get();
  
  if (snapshot.empty) return null;
  
  return snapshot.docs[0].data().createdAt;
}
