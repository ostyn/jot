import { autoinject } from "aurelia-framework";
import { IEntry } from "./../elements/entry/entry.interface";
import { DexieDao } from "./DexieDao";
import { DexieDatabase } from "./DexieDatabase";
@autoinject
export class EntryDao extends DexieDao {
  path;
  constructor(dexie: DexieDatabase) {
    super("entries", dexie);
  }

  async getAll() {
    return this.dexie.db[this.name].toArray();
  }
  async getEntriesFromYearAndMonth(
    year = undefined,
    month = undefined,
    day = undefined
  ) {
    let queryObj = {};
    if (day !== undefined && day !== "" && !Number.isNaN(day))
      queryObj["day"] = day;
    if (month !== undefined && month !== "" && !Number.isNaN(month))
      queryObj["month"] = month;
    if (year !== undefined && year !== "" && !Number.isNaN(year))
      queryObj["year"] = year;
    let x = await this.dexie.db[this.name]
      .where(queryObj)
      .reverse()
      .sortBy("date");

    return this.getItemsFromQuery(x);
  }
  // private backfill() {
  //   let batch = this.db.batch();

  //   this.db
  //     .collection("entries")
  //     .where("userId", "==", firebase.auth().currentUser.uid)
  //     .get()
  //     .then((querySnapshot) => {
  //       let i = 0;
  //       querySnapshot.forEach((doc) => {
  //         const docRef = this.db.collection("entries").doc(doc.id);
  //         batch.update(docRef, {
  //           activitiesArray: Array.from(
  //             this.processFirestoreData(doc).activities.keys()
  //           ),
  //         });
  //         i++;
  //         if (i > 100) {
  //           batch.commit();
  //           batch = this.db.batch();
  //           i = 0;
  //         }
  //       });

  //       batch.commit();
  //     });
  // }

  beforeSaveFixup(item: IEntry) {
    var clone = Object.assign({}, item);
    clone.activitiesArray = Array.from(item.activities.keys());
    return clone;
  }
}
