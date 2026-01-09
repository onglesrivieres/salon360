
import os
import hashlib
import sys

def get_file_hash(filepath):
    hasher = hashlib.md5()
    with open(filepath, 'rb') as f:
        buf = f.read()
        hasher.update(buf)
    return hasher.hexdigest()

def dedup_migrations(directory):
    # Map hash -> list of files
    hashes = {}
    
    for root, dirs, files in os.walk(directory):
        for name in files:
            if not name.endswith('.sql'):
                continue
            filepath = os.path.join(root, name)
            filehash = get_file_hash(filepath)
            
            if filehash not in hashes:
                hashes[filehash] = []
            hashes[filehash].append(filepath)
    
    # Process duplicates
    duplicates_removed = 0
    for filehash, filepaths in hashes.items():
        if len(filepaths) > 1:
            # Sort by filename (which starts with timestamp)
            # We want to keep the EARLIEST one.
            filepaths.sort(key=lambda x: os.path.basename(x))
            
            keep = filepaths[0]
            remove = filepaths[1:]
            
            print(f"Keeping: {keep}")
            for rm in remove:
                print(f"  Deleting duplicate: {rm}")
                os.remove(rm)
                duplicates_removed += 1
                
    print(f"Removed {duplicates_removed} duplicate files.")

if __name__ == "__main__":
    dedup_migrations("supabase/migrations")
