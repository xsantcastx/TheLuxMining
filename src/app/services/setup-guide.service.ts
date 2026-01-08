import { Injectable, inject } from '@angular/core';
import { Firestore, collection, doc, getDoc, setDoc, updateDoc, Timestamp } from '@angular/fire/firestore';
import { SetupGuide, SetupGuideStep } from '../models/setup-guide';

@Injectable({
  providedIn: 'root'
})
export class SetupGuideService {
  private firestore = inject(Firestore);
  private readonly COLLECTION_NAME = 'setupGuides';
  private readonly DEFAULT_GUIDE_ID = 'main-setup-guide';

  /**
   * Get the published setup guide (for public view)
   */
  async getPublishedGuide(): Promise<SetupGuide | null> {
    try {
      const docRef = doc(this.firestore, this.COLLECTION_NAME, this.DEFAULT_GUIDE_ID);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data['isPublished']) {
          return this.convertTimestamps(data) as SetupGuide;
        }
      }
      return null;
    } catch (error) {
      console.error('Error getting published setup guide:', error);
      return null;
    }
  }

  /**
   * Get the setup guide (for admin editing)
   */
  async getGuide(): Promise<SetupGuide | null> {
    try {
      const docRef = doc(this.firestore, this.COLLECTION_NAME, this.DEFAULT_GUIDE_ID);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        return this.convertTimestamps(docSnap.data()) as SetupGuide;
      }
      
      // Return default empty guide if doesn't exist
      return this.getDefaultGuide();
    } catch (error) {
      console.error('Error getting setup guide:', error);
      return null;
    }
  }

  /**
   * Save or update the setup guide
   */
  async saveGuide(guide: Partial<SetupGuide>): Promise<void> {
    try {
      const docRef = doc(this.firestore, this.COLLECTION_NAME, this.DEFAULT_GUIDE_ID);
      const docSnap = await getDoc(docRef);
      
      const now = Timestamp.now();
      
      if (docSnap.exists()) {
        // Update existing guide
        await updateDoc(docRef, {
          ...guide,
          updatedAt: now
        });
      } else {
        // Create new guide
        await setDoc(docRef, {
          id: this.DEFAULT_GUIDE_ID,
          ...guide,
          createdAt: now,
          updatedAt: now
        });
      }
    } catch (error) {
      console.error('Error saving setup guide:', error);
      throw error;
    }
  }

  /**
   * Publish or unpublish the guide
   */
  async togglePublish(isPublished: boolean): Promise<void> {
    try {
      const docRef = doc(this.firestore, this.COLLECTION_NAME, this.DEFAULT_GUIDE_ID);
      await updateDoc(docRef, {
        isPublished,
        updatedAt: Timestamp.now()
      });
    } catch (error) {
      console.error('Error toggling publish status:', error);
      throw error;
    }
  }

  /**
   * Get default empty guide structure
   */
  private getDefaultGuide(): SetupGuide {
    return {
      id: this.DEFAULT_GUIDE_ID,
      title: 'Solo Miner Setup Guide',
      subtitle: 'Get your miner up and running in minutes',
      introduction: 'Welcome! This guide will walk you through setting up your new solo miner.',
      steps: [],
      requirements: [],
      faqs: [],
      isPublished: false,
      createdAt: new Date(),
      updatedAt: new Date()
    };
  }

  /**
   * Convert Firestore timestamps to Date objects
   */
  private convertTimestamps(data: any): any {
    const converted = { ...data };
    
    if (data['createdAt']?.toDate) {
      converted.createdAt = data['createdAt'].toDate();
    }
    if (data['updatedAt']?.toDate) {
      converted.updatedAt = data['updatedAt'].toDate();
    }
    
    return converted;
  }
}
